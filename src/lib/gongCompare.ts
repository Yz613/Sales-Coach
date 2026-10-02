import {
  EVAL_OVERAGE_RATE_USD,
  HOSTED_PLANS,
  evaluationCreditsForDuration,
  type HostedPlanId,
} from "./billing";

/**
 * Gong list-price defaults for the marketing calculator.
 *
 * Third-party summaries of 2025–2026 Gong quotes (not a Gong price sheet):
 * - Core / Foundations licence often about $1,300–$1,600 per user per year
 *   (~$108–$133 per user per month). Default seat: $1,500/user/year.
 * - A separate annual platform fee is often cited from $5,000 to $50,000.
 *   Default platform fee: $10,000/year.
 * - Add-ons often cited separately: Forecast about $700/user/year, Engage
 *   about $800/user/year. Both default off.
 *
 * Published summaries include revenue.io, tropicapp, oliv.ai, saasbluebook,
 * and roonly. Gong sells on a custom quote, so seats, $/seat/year, and the
 * platform fee stay editable.
 *
 * Self-host $/eval tiers are round estimates for one scored call (review-sized
 * model usage plus a modest transcription allowance): Fast $0.15, Balanced
 * $0.40, Strong $0.90. Buyers can override with their own $/eval. Hosted
 * plans ignore the rate and use HOSTED_PLANS plus overage.
 */

export const GONG_DEFAULT_SEAT_USD_PER_YEAR = 1500;
export const GONG_DEFAULT_PLATFORM_FEE_USD_PER_YEAR = 10_000;
export const GONG_FORECAST_USD_PER_USER_YEAR = 700;
export const GONG_ENGAGE_USD_PER_USER_YEAR = 800;

export const GONG_COMPARE_DISCLAIMER =
  "Estimate based on public list pricing. Gong quotes custom. Change seats, price per seat, and the platform fee to match a quote you have.";

export const CALL_CREDIT_RULE_SHORT =
  "First 60 minutes counts as 1 evaluation credit. Each extra 30 minutes adds another.";

export const SELF_HOST_RATE_NOTE =
  "Rough $/eval for one scored call. Hosted plans do not use this rate.";

export const SELF_HOST_EVAL_TIERS = [
  { id: "fast", label: "Fast", usdPerEval: 0.15, blurb: "Lower-cost model" },
  { id: "balanced", label: "Balanced", usdPerEval: 0.4, blurb: "Typical quality" },
  { id: "strong", label: "Strong", usdPerEval: 0.9, blurb: "Higher-cost model" },
] as const;

export type SelfHostTierId = (typeof SELF_HOST_EVAL_TIERS)[number]["id"] | "custom";

export const GONG_COMPARE_DEFAULTS = {
  reps: 10,
  callsPerRepPerMonth: 20,
  averageCallMinutes: 45,
  gongSeats: 10,
  seatUsdPerYear: GONG_DEFAULT_SEAT_USD_PER_YEAR,
  platformFeeUsdPerYear: GONG_DEFAULT_PLATFORM_FEE_USD_PER_YEAR,
  includeForecast: false,
  includeEngage: false,
  tierId: "balanced" as SelfHostTierId,
  customUsdPerEval: 0.4,
};

export type PaidHostedPlanId = Exclude<HostedPlanId, "oss">;
export type HostedPlanChoice = "auto" | PaidHostedPlanId;

export type GongQuoteInput = {
  seats: number;
  seatUsdPerYear: number;
  platformFeeUsdPerYear: number;
  includeForecast: boolean;
  includeEngage: boolean;
};

export type GongComparisonInput = {
  callsPerMonth: number;
  averageCallMinutes: number;
  mode: "self-host" | "hosted";
  planChoice: HostedPlanChoice;
  usdPerEval: number;
  gong: GongQuoteInput;
};

export type HostedCostResult = {
  planId: PaidHostedPlanId;
  planName: string;
  monthlyPriceUsd: number;
  includedEvals: number;
  overageCredits: number;
  overageUsd: number;
  monthlyUsd: number;
  coversVolume: boolean;
  fairUseExceeded: boolean;
};

export type GongComparisonResult = {
  callsPerMonth: number;
  creditsPerCall: number;
  monthlyCredits: number;
  gong: {
    seats: number;
    seatUsdPerYear: number;
    addonUsdPerSeatYear: number;
    licenseUsdPerYear: number;
    platformFeeUsdPerYear: number;
    monthlyUsd: number;
    yearlyUsd: number;
  };
  salesCoach: {
    mode: "self-host" | "hosted";
    monthlyUsd: number;
    yearlyUsd: number;
    usageUsd: number;
    usdPerEval: number;
    likeForLike: boolean;
    hosted: HostedCostResult | null;
  };
  savings: {
    monthlyUsd: number;
    yearlyUsd: number;
    /** Null when the Gong estimate is $0. Positive means Sales Coach costs less. */
    percentCheaper: number | null;
  };
};

const PAID_PLAN_ORDER: PaidHostedPlanId[] = ["coach", "team", "enterprise"];
const OVERAGE_CENTS = Math.round(EVAL_OVERAGE_RATE_USD * 100);

function nonNegative(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
}

function count(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value);
}

function centsToUsd(cents: number): number {
  return cents / 100;
}

export function selfHostUsdPerEval(tierId: SelfHostTierId, customUsdPerEval: number): number {
  if (tierId === "custom") return nonNegative(customUsdPerEval);
  const tier = SELF_HOST_EVAL_TIERS.find((item) => item.id === tierId);
  return tier ? tier.usdPerEval : SELF_HOST_EVAL_TIERS[1].usdPerEval;
}

export function monthlyEvaluationCredits(callsPerMonth: number, averageCallMinutes: number): {
  calls: number;
  creditsPerCall: number;
  credits: number;
} {
  const calls = count(callsPerMonth);
  const minutes = nonNegative(averageCallMinutes);
  const creditsPerCall = evaluationCreditsForDuration(minutes * 60);
  return { calls, creditsPerCall, credits: calls * creditsPerCall };
}

export function gongYearlyCents(input: GongQuoteInput): number {
  const seats = count(input.seats);
  const seatCents = Math.round(nonNegative(input.seatUsdPerYear) * 100);
  const platformCents = Math.round(nonNegative(input.platformFeeUsdPerYear) * 100);
  const addonPerSeat =
    (input.includeForecast ? GONG_FORECAST_USD_PER_USER_YEAR : 0) +
    (input.includeEngage ? GONG_ENGAGE_USD_PER_USER_YEAR : 0);
  const addonCents = Math.round(addonPerSeat * 100);
  return seats * (seatCents + addonCents) + platformCents;
}

export function hostedPlanCost(planId: PaidHostedPlanId, monthlyCredits: number): HostedCostResult {
  const plan = HOSTED_PLANS[planId];
  const credits = count(monthlyCredits);
  const included = plan.monthlyEvals ?? 0;
  const baseCents = Math.round(plan.monthlyPriceUsd * 100);

  if (plan.allowsOverage) {
    const overageCredits = Math.max(0, credits - included);
    const overageCents = overageCredits * OVERAGE_CENTS;
    return {
      planId,
      planName: plan.name,
      monthlyPriceUsd: plan.monthlyPriceUsd,
      includedEvals: included,
      overageCredits,
      overageUsd: centsToUsd(overageCents),
      monthlyUsd: centsToUsd(baseCents + overageCents),
      coversVolume: true,
      fairUseExceeded: false,
    };
  }

  const fairUseExceeded = credits > included;
  return {
    planId,
    planName: plan.name,
    monthlyPriceUsd: plan.monthlyPriceUsd,
    includedEvals: included,
    overageCredits: 0,
    overageUsd: 0,
    monthlyUsd: centsToUsd(baseCents),
    coversVolume: !fairUseExceeded,
    fairUseExceeded,
  };
}

/** Cheapest paid plan that includes this volume. Equal prices prefer Coach, then Team. */
export function cheapestCoveringHostedPlan(monthlyCredits: number): HostedCostResult {
  const covering = PAID_PLAN_ORDER.map((planId) => hostedPlanCost(planId, monthlyCredits)).filter(
    (plan) => plan.coversVolume
  );
  covering.sort((a, b) => {
    const cost = a.monthlyUsd - b.monthlyUsd;
    if (cost !== 0) return cost;
    return PAID_PLAN_ORDER.indexOf(a.planId) - PAID_PLAN_ORDER.indexOf(b.planId);
  });
  return covering[0] ?? hostedPlanCost("team", monthlyCredits);
}

export function selectHostedPlan(monthlyCredits: number, choice: HostedPlanChoice): HostedCostResult {
  if (choice === "auto") return cheapestCoveringHostedPlan(monthlyCredits);
  return hostedPlanCost(choice, monthlyCredits);
}

export function buildGongComparison(input: GongComparisonInput): GongComparisonResult {
  const usage = monthlyEvaluationCredits(input.callsPerMonth, input.averageCallMinutes);
  const gongYearly = gongYearlyCents(input.gong);
  const seats = count(input.gong.seats);
  const seatCents = Math.round(nonNegative(input.gong.seatUsdPerYear) * 100);
  const addonPerSeat =
    (input.gong.includeForecast ? GONG_FORECAST_USD_PER_USER_YEAR : 0) +
    (input.gong.includeEngage ? GONG_ENGAGE_USD_PER_USER_YEAR : 0);
  const addonCents = Math.round(addonPerSeat * 100);
  const platformCents = Math.round(nonNegative(input.gong.platformFeeUsdPerYear) * 100);

  const usdPerEval = nonNegative(input.usdPerEval);
  let monthlyCents = 0;
  let hosted: HostedCostResult | null = null;
  let likeForLike = true;

  if (input.mode === "hosted") {
    hosted = selectHostedPlan(usage.credits, input.planChoice);
    monthlyCents = Math.round(hosted.monthlyUsd * 100);
    likeForLike = hosted.coversVolume;
  } else {
    monthlyCents = Math.round(usage.credits * usdPerEval * 100);
  }

  const yearlyCents = monthlyCents * 12;
  const savingsYearlyCents = gongYearly - yearlyCents;
  const percentCheaper = gongYearly > 0 ? (savingsYearlyCents / gongYearly) * 100 : null;

  return {
    callsPerMonth: usage.calls,
    creditsPerCall: usage.creditsPerCall,
    monthlyCredits: usage.credits,
    gong: {
      seats,
      seatUsdPerYear: centsToUsd(seatCents),
      addonUsdPerSeatYear: centsToUsd(addonCents),
      licenseUsdPerYear: centsToUsd(seats * (seatCents + addonCents)),
      platformFeeUsdPerYear: centsToUsd(platformCents),
      yearlyUsd: centsToUsd(gongYearly),
      monthlyUsd: centsToUsd(Math.round(gongYearly / 12)),
    },
    salesCoach: {
      mode: input.mode,
      monthlyUsd: centsToUsd(monthlyCents),
      yearlyUsd: centsToUsd(yearlyCents),
      usageUsd: input.mode === "self-host" ? centsToUsd(monthlyCents) : 0,
      usdPerEval,
      likeForLike,
      hosted,
    },
    savings: {
      yearlyUsd: centsToUsd(savingsYearlyCents),
      monthlyUsd: centsToUsd(Math.round(savingsYearlyCents / 12)),
      percentCheaper,
    },
  };
}

export function formatUsd(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  const whole = Math.abs(rounded - Math.trunc(rounded)) < 0.001;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(Object.is(rounded, -0) ? 0 : rounded);
}

export function formatPercentCheaper(percent: number): string {
  const rounded = Math.round(percent * 10) / 10;
  const text = Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1);
  return `${text}%`;
}

export const EVAL_OVERAGE_RATE_USD = 0.85;
export const STANDARD_CALL_MINUTES = 60;
export const EXTRA_CALL_BLOCK_MINUTES = 30;
export const ENTERPRISE_FAIR_USE_EVALS = 4000;
export const HOSTED_COACH_EVALS = 250;
export const HOSTED_TEAM_EVALS = 1200;

export const CALL_DURATION_NOTE =
  "Covers standard sales calls up to 60 minutes. Calls exceeding 60 minutes consume 1 evaluation credit per additional 30-minute block.";

export const OVERAGE_LINE = "+ $0.85 per additional evaluation after plan limit";

export const ENTERPRISE_SEATS_BULLET =
  "Unlimited seats · Fair-use quota of up to 4,000 call evaluations/mo (custom high-volume tiers available).";

export const FAQ_EXCEED_MONTHLY = {
  question: "What happens if we exceed our monthly evaluations?",
  answer:
    "You can continue evaluating calls uninterrupted at a flat rate of $0.85/call, billed at the end of your billing cycle.",
};

export const FAQ_ENTERPRISE_FAIR_USE = {
  question: "Enterprise fair use",
  answer:
    "Enterprise fair use is set at 4,000 monthly calls (~$0.75 effective cost/call with dedicated infrastructure and SLA). Organizations requiring higher throughput get dedicated pooled clusters.",
};

export type HostedPlanId = "oss" | "coach" | "team" | "enterprise";

export type HostedPlan = {
  id: HostedPlanId;
  name: string;
  monthlyPriceUsd: number;
  monthlyEvals: number | null;
  allowsOverage: boolean;
  defaultOverageOptIn: boolean;
};

export const HOSTED_PLANS: Record<HostedPlanId, HostedPlan> = {
  oss: {
    id: "oss",
    name: "Open Source",
    monthlyPriceUsd: 0,
    monthlyEvals: null,
    allowsOverage: false,
    defaultOverageOptIn: false,
  },
  coach: {
    id: "coach",
    name: "Hosted Coach",
    monthlyPriceUsd: 249,
    monthlyEvals: HOSTED_COACH_EVALS,
    allowsOverage: true,
    defaultOverageOptIn: true,
  },
  team: {
    id: "team",
    name: "Hosted Team",
    monthlyPriceUsd: 899,
    monthlyEvals: HOSTED_TEAM_EVALS,
    allowsOverage: true,
    defaultOverageOptIn: true,
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    monthlyPriceUsd: 2997,
    monthlyEvals: ENTERPRISE_FAIR_USE_EVALS,
    allowsOverage: false,
    defaultOverageOptIn: false,
  },
};

export function isHostedPlanId(value: string | null | undefined): value is HostedPlanId {
  return Boolean(value && value in HOSTED_PLANS);
}

export function parseHostedPlanId(value: string | null | undefined): HostedPlanId | null {
  const normalized = (value || "").trim().toLowerCase();
  if (normalized === "starter" || normalized === "hosted_coach") return "coach";
  if (normalized === "pro" || normalized === "hosted_team") return "team";
  if (isHostedPlanId(normalized)) return normalized;
  return null;
}

/** First 60 minutes = 1 credit; each additional 30-minute block (or fraction) = +1. */
export function evaluationCreditsForDuration(durationSeconds: number | null | undefined): number {
  const seconds = Math.max(0, Number(durationSeconds) || 0);
  if (seconds <= 0) return 1;
  const minutes = seconds / 60;
  if (minutes <= STANDARD_CALL_MINUTES) return 1;
  const extra = minutes - STANDARD_CALL_MINUTES;
  return 1 + Math.ceil(extra / EXTRA_CALL_BLOCK_MINUTES);
}

export function utcMonthKey(date: Date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export type QuotaDecision =
  | {
      ok: true;
      blocked: false;
      includedCredits: number;
      overageCredits: number;
      overageAmountUsd: number;
      creditsAfter: number;
    }
  | {
      ok: false;
      blocked: true;
      code: "QUOTA_EXCEEDED" | "FAIR_USE_EXCEEDED";
      error: string;
      includedCredits: number;
      overageCredits: number;
      overageAmountUsd: number;
      creditsAfter: number;
    };

export function assessEvalQuota(input: {
  planId: HostedPlanId;
  monthlyLimit: number | null;
  creditsUsed: number;
  requestedCredits: number;
  overageOptIn: boolean;
}): QuotaDecision {
  const requested = Math.max(1, Math.floor(input.requestedCredits || 1));
  const used = Math.max(0, Math.floor(input.creditsUsed || 0));

  if (input.planId === "oss" || input.monthlyLimit == null) {
    return {
      ok: true,
      blocked: false,
      includedCredits: requested,
      overageCredits: 0,
      overageAmountUsd: 0,
      creditsAfter: used + requested,
    };
  }

  const limit = Math.max(0, input.monthlyLimit);
  const remaining = Math.max(0, limit - used);
  const included = Math.min(remaining, requested);
  const overage = requested - included;
  const creditsAfter = used + requested;

  if (overage <= 0) {
    return {
      ok: true,
      blocked: false,
      includedCredits: requested,
      overageCredits: 0,
      overageAmountUsd: 0,
      creditsAfter,
    };
  }

  const plan = HOSTED_PLANS[input.planId];
  if (plan.allowsOverage && input.overageOptIn) {
    return {
      ok: true,
      blocked: false,
      includedCredits: included,
      overageCredits: overage,
      overageAmountUsd: Number((overage * EVAL_OVERAGE_RATE_USD).toFixed(2)),
      creditsAfter,
    };
  }

  if (input.planId === "enterprise") {
    return {
      ok: false,
      blocked: true,
      code: "FAIR_USE_EXCEEDED",
      error: `Enterprise fair-use allotment of ${ENTERPRISE_FAIR_USE_EVALS.toLocaleString()} evaluations this month is used. Contact us for a custom high-volume tier.`,
      includedCredits: included,
      overageCredits: 0,
      overageAmountUsd: 0,
      creditsAfter: used,
    };
  }

  return {
    ok: false,
    blocked: true,
    code: "QUOTA_EXCEEDED",
    error: `Monthly evaluation allotment of ${limit.toLocaleString()} is used. Enable overage billing (${OVERAGE_LINE}) in Admin → Settings to keep evaluating.`,
    includedCredits: included,
    overageCredits: 0,
    overageAmountUsd: 0,
    creditsAfter: used,
  };
}

export function formatEvalCreditLabel(credits: number): string {
  return credits === 1 ? "1 evaluation credit" : `${credits} evaluation credits`;
}

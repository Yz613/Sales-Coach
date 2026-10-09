import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EVAL_OVERAGE_RATE_USD, HOSTED_PLANS, evaluationCreditsForDuration } from "./billing";
import {
  CALL_CREDIT_RULE_SHORT,
  GONG_COMPARE_DEFAULTS,
  GONG_COMPARE_DISCLAIMER,
  GONG_DEFAULT_PLATFORM_FEE_USD_PER_YEAR,
  GONG_DEFAULT_SEAT_USD_PER_YEAR,
  GONG_ENGAGE_USD_PER_USER_YEAR,
  GONG_FORECAST_USD_PER_USER_YEAR,
  SELF_HOST_EVAL_TIERS,
  buildGongComparison,
  cheapestCoveringHostedPlan,
  formatPercentCheaper,
  formatUsd,
  gongYearlyCents,
  hostedPlanCost,
  monthlyEvaluationCredits,
  selfHostUsdPerEval,
  type GongQuoteInput,
} from "./gongCompare";

const defaultGong = (): GongQuoteInput => ({
  seats: GONG_COMPARE_DEFAULTS.gongSeats,
  seatUsdPerYear: GONG_COMPARE_DEFAULTS.seatUsdPerYear,
  platformFeeUsdPerYear: GONG_COMPARE_DEFAULTS.platformFeeUsdPerYear,
  includeForecast: false,
  includeEngage: false,
});

describe("monthlyEvaluationCredits", () => {
  it("reuses the 60-minute credit rule", () => {
    assert.equal(monthlyEvaluationCredits(10, 45).creditsPerCall, evaluationCreditsForDuration(45 * 60));
    assert.equal(monthlyEvaluationCredits(10, 45).credits, 10);
    assert.equal(monthlyEvaluationCredits(10, 60).creditsPerCall, 1);
    assert.equal(monthlyEvaluationCredits(10, 61).creditsPerCall, 2);
    assert.equal(monthlyEvaluationCredits(8, 90).credits, 16);
    assert.equal(monthlyEvaluationCredits(4, 120).credits, 12);
  });

  it("drops empty or invalid volume", () => {
    assert.equal(monthlyEvaluationCredits(0, 45).credits, 0);
    assert.equal(monthlyEvaluationCredits(Number.NaN, 45).credits, 0);
    assert.equal(monthlyEvaluationCredits(-3, 45).credits, 0);
  });
});

describe("Gong quote", () => {
  it("uses the published default seat and platform fee", () => {
    assert.equal(GONG_DEFAULT_SEAT_USD_PER_YEAR, 1500);
    assert.equal(GONG_DEFAULT_PLATFORM_FEE_USD_PER_YEAR, 10_000);
    assert.equal(GONG_FORECAST_USD_PER_USER_YEAR, 700);
    assert.equal(GONG_ENGAGE_USD_PER_USER_YEAR, 800);
    assert.equal(GONG_COMPARE_DEFAULTS.includeForecast, false);
    assert.equal(GONG_COMPARE_DEFAULTS.includeEngage, false);
    assert.match(GONG_COMPARE_DISCLAIMER, /third-party buyer data/);
    assert.match(GONG_COMPARE_DISCLAIMER, /does not publish list prices/);
    assert.match(GONG_COMPARE_DISCLAIMER, /Gong quotes custom/);
    assert.doesNotMatch(GONG_COMPARE_DISCLAIMER, /Vendr|public list pricing/i);
    assert.match(CALL_CREDIT_RULE_SHORT, /60 minutes/);
    assert.match(CALL_CREDIT_RULE_SHORT, /30 minutes/);
  });

  it("prices seats, platform fee, and optional add-ons per year", () => {
    const base = gongYearlyCents(defaultGong());
    assert.equal(base, (10 * 1500 + 10_000) * 100);

    const withAddons = gongYearlyCents({
      ...defaultGong(),
      includeForecast: true,
      includeEngage: true,
    });
    assert.equal(withAddons, (10 * (1500 + 700 + 800) + 10_000) * 100);

    const custom = gongYearlyCents({
      seats: 25,
      seatUsdPerYear: 1360,
      platformFeeUsdPerYear: 5000,
      includeForecast: true,
      includeEngage: false,
    });
    assert.equal(custom, (25 * (1360 + 700) + 5000) * 100);
  });

  it("ignores negative quote inputs", () => {
    assert.equal(
      gongYearlyCents({
        seats: -4,
        seatUsdPerYear: -100,
        platformFeeUsdPerYear: -50,
        includeForecast: false,
        includeEngage: false,
      }),
      0
    );
  });
});

describe("hosted plan selection", () => {
  it("bills Coach and Team from HOSTED_PLANS plus $1.25 overage", () => {
    assert.equal(EVAL_OVERAGE_RATE_USD, 1.25);
    const inside = hostedPlanCost("coach", 200);
    assert.equal(inside.monthlyUsd, HOSTED_PLANS.coach.monthlyPriceUsd);
    assert.equal(inside.overageCredits, 0);

    const over = hostedPlanCost("coach", 300);
    assert.equal(over.overageCredits, 50);
    assert.equal(over.overageUsd, 62.5);
    assert.equal(over.monthlyUsd, 461.5);

    const teamInside = hostedPlanCost("team", 1200);
    assert.equal(teamInside.monthlyUsd, HOSTED_PLANS.team.monthlyPriceUsd);
    assert.equal(hostedPlanCost("team", 1201).monthlyUsd, 1499 + 1.25);
  });

  it("picks the cheapest plan that covers the volume", () => {
    assert.equal(cheapestCoveringHostedPlan(200).planId, "coach");
    assert.equal(cheapestCoveringHostedPlan(1130).planId, "coach");
    assert.equal(cheapestCoveringHostedPlan(1130).monthlyUsd, 1499);
    assert.equal(cheapestCoveringHostedPlan(1131).planId, "team");
    assert.equal(cheapestCoveringHostedPlan(1131).monthlyUsd, 1499);

    const atFairUse = cheapestCoveringHostedPlan(4000);
    assert.equal(atFairUse.planId, "enterprise");
    assert.equal(atFairUse.monthlyUsd, HOSTED_PLANS.enterprise.monthlyPriceUsd);

    const aboveFairUse = cheapestCoveringHostedPlan(4001);
    assert.equal(aboveFairUse.planId, "team");
    assert.equal(aboveFairUse.coversVolume, true);
    assert.equal(hostedPlanCost("enterprise", 4001).fairUseExceeded, true);
    assert.equal(hostedPlanCost("enterprise", 4001).coversVolume, false);
    assert.equal(hostedPlanCost("enterprise", 4001).monthlyUsd, HOSTED_PLANS.enterprise.monthlyPriceUsd);
  });
});

describe("buildGongComparison", () => {
  const typicalCalls =
    GONG_COMPARE_DEFAULTS.reps * GONG_COMPARE_DEFAULTS.callsPerRepPerMonth;

  function typical(mode: "hosted" | "self-host", overrides: Partial<Parameters<typeof buildGongComparison>[0]> = {}) {
    return buildGongComparison({
      callsPerMonth: typicalCalls,
      averageCallMinutes: GONG_COMPARE_DEFAULTS.averageCallMinutes,
      mode,
      planChoice: "auto",
      usdPerEval: selfHostUsdPerEval(GONG_COMPARE_DEFAULTS.tierId, GONG_COMPARE_DEFAULTS.customUsdPerEval),
      gong: defaultGong(),
      ...overrides,
    });
  }

  it("shows hosted and self-host far below Gong at the default volume", () => {
    const hosted = typical("hosted");
    const selfHost = typical("self-host");

    assert.equal(hosted.monthlyCredits, 200);
    assert.equal(hosted.gong.yearlyUsd, 25_000);
    assert.equal(hosted.gong.monthlyUsd, 2083.33);
    assert.equal(hosted.salesCoach.hosted?.planId, "coach");
    assert.equal(hosted.salesCoach.monthlyUsd, 399);
    assert.equal(hosted.salesCoach.yearlyUsd, 4788);
    assert.equal(hosted.savings.yearlyUsd, 20_212);
    assert.ok((hosted.savings.percentCheaper ?? 0) > 80);

    assert.equal(selfHost.salesCoach.monthlyUsd, 80);
    assert.equal(selfHost.salesCoach.yearlyUsd, 960);
    assert.equal(selfHost.savings.yearlyUsd, 24_040);
    assert.ok((selfHost.savings.percentCheaper ?? 0) > 90);
    assert.equal(selfHost.salesCoach.hosted, null);
  });

  it("keeps hosted price independent of the model rate", () => {
    const cheap = typical("hosted", { usdPerEval: 0.15 });
    const expensive = typical("hosted", { usdPerEval: 9 });
    assert.equal(cheap.salesCoach.monthlyUsd, expensive.salesCoach.monthlyUsd);
    assert.notEqual(typical("self-host", { usdPerEval: 0.15 }).salesCoach.monthlyUsd, typical("self-host", { usdPerEval: 0.9 }).salesCoach.monthlyUsd);
  });

  it("lets a manual Enterprise pick exceed fair use without inventing overage", () => {
    const result = buildGongComparison({
      callsPerMonth: 4500,
      averageCallMinutes: 30,
      mode: "hosted",
      planChoice: "enterprise",
      usdPerEval: 0.4,
      gong: defaultGong(),
    });
    assert.equal(result.salesCoach.likeForLike, false);
    assert.equal(result.salesCoach.hosted?.fairUseExceeded, true);
    assert.equal(result.salesCoach.hosted?.overageUsd, 0);
    assert.equal(result.salesCoach.monthlyUsd, 4997);
  });

  it("returns no percent when the Gong estimate is zero", () => {
    const result = buildGongComparison({
      callsPerMonth: 10,
      averageCallMinutes: 30,
      mode: "self-host",
      planChoice: "auto",
      usdPerEval: 0.4,
      gong: { seats: 0, seatUsdPerYear: 0, platformFeeUsdPerYear: 0, includeForecast: false, includeEngage: false },
    });
    assert.equal(result.gong.yearlyUsd, 0);
    assert.equal(result.savings.percentCheaper, null);
  });

  it("formats money and percent for the landing", () => {
    assert.equal(formatUsd(399), "$399");
    assert.equal(formatUsd(461.5), "$461.50");
    assert.equal(formatUsd(25000), "$25,000");
    assert.equal(formatUsd(0.4), "$0.40");
    assert.equal(formatPercentCheaper(80.848), "80.8%");
    assert.equal(formatPercentCheaper(96), "96%");
    assert.equal(SELF_HOST_EVAL_TIERS.map((tier) => tier.label).join(","), "Fast,Balanced,Strong");
  });
});

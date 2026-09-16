import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CALL_DURATION_NOTE,
  ENTERPRISE_FAIR_USE_EVALS,
  ENTERPRISE_SEATS_BULLET,
  EVAL_OVERAGE_RATE_USD,
  FAQ_ENTERPRISE_FAIR_USE,
  FAQ_EXCEED_MONTHLY,
  HOSTED_COACH_EVALS,
  HOSTED_PLANS,
  HOSTED_TEAM_EVALS,
  OVERAGE_LINE,
  assessEvalQuota,
  evaluationCreditsForDuration,
  parseHostedPlanId,
} from "./billing";

describe("evaluationCreditsForDuration", () => {
  it("charges 1 credit through the first 60 minutes, then +1 per 30-minute block", () => {
    assert.equal(evaluationCreditsForDuration(0), 1);
    assert.equal(evaluationCreditsForDuration(60), 1);
    assert.equal(evaluationCreditsForDuration(60 * 60), 1);
    assert.equal(evaluationCreditsForDuration(60 * 60 + 1), 2);
    assert.equal(evaluationCreditsForDuration(90 * 60), 2);
    assert.equal(evaluationCreditsForDuration(90 * 60 + 1), 3);
    assert.equal(evaluationCreditsForDuration(120 * 60), 3);
  });
});

describe("assessEvalQuota", () => {
  it("lets Hosted Coach continue past 250 when overage is on", () => {
    const decision = assessEvalQuota({
      planId: "coach",
      monthlyLimit: HOSTED_COACH_EVALS,
      creditsUsed: 249,
      requestedCredits: 2,
      overageOptIn: true,
    });
    assert.equal(decision.ok, true);
    if (decision.ok) {
      assert.equal(decision.includedCredits, 1);
      assert.equal(decision.overageCredits, 1);
      assert.equal(decision.overageAmountUsd, EVAL_OVERAGE_RATE_USD);
    }
  });

  it("hard-fails Hosted Team at 1,200 when overage is off", () => {
    const decision = assessEvalQuota({
      planId: "team",
      monthlyLimit: HOSTED_TEAM_EVALS,
      creditsUsed: 1200,
      requestedCredits: 1,
      overageOptIn: false,
    });
    assert.equal(decision.ok, false);
    if (!decision.ok) {
      assert.equal(decision.code, "QUOTA_EXCEEDED");
      assert.match(decision.error, /1,200/);
    }
  });

  it("caps Enterprise at 4,000 with no $0.85 overage", () => {
    const decision = assessEvalQuota({
      planId: "enterprise",
      monthlyLimit: ENTERPRISE_FAIR_USE_EVALS,
      creditsUsed: 3999,
      requestedCredits: 2,
      overageOptIn: true,
    });
    assert.equal(decision.ok, false);
    if (!decision.ok) {
      assert.equal(decision.code, "FAIR_USE_EXCEEDED");
      assert.match(decision.error, /4,000/);
    }
  });

  it("does not limit open-source / self-host", () => {
    const decision = assessEvalQuota({
      planId: "oss",
      monthlyLimit: null,
      creditsUsed: 50_000,
      requestedCredits: 8,
      overageOptIn: false,
    });
    assert.equal(decision.ok, true);
  });
});

describe("hosted plan copy constants", () => {
  it("keeps Coach / Team / Enterprise numbers aligned", () => {
    assert.equal(HOSTED_PLANS.coach.monthlyPriceUsd, 249);
    assert.equal(HOSTED_PLANS.coach.monthlyEvals, 250);
    assert.equal(HOSTED_PLANS.team.monthlyPriceUsd, 899);
    assert.equal(HOSTED_PLANS.team.monthlyEvals, 1200);
    assert.equal(HOSTED_PLANS.enterprise.monthlyPriceUsd, 2997);
    assert.equal(HOSTED_PLANS.enterprise.monthlyEvals, 4000);
    assert.equal(parseHostedPlanId("starter"), "coach");
    assert.equal(parseHostedPlanId("pro"), "team");
    assert.match(OVERAGE_LINE, /\$0\.85/);
    assert.match(CALL_DURATION_NOTE, /60 minutes/);
    assert.match(ENTERPRISE_SEATS_BULLET, /4,000 call evaluations/);
    assert.match(FAQ_EXCEED_MONTHLY.answer, /\$0\.85\/call/);
    assert.match(FAQ_ENTERPRISE_FAIR_USE.answer, /4,000 monthly calls/);
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CONTACT_EMAIL,
  CONTACT_MAILTO,
  GITHUB_REPO_URL,
  LICENSE_URL,
  PRICING_DURATION_NOTE,
  PRICING_FAQS,
  PRICING_PLANS,
} from "./marketing";
import { ENTERPRISE_SEATS_BULLET, HOSTED_COACH_EVALS, OVERAGE_LINE } from "./billing";

describe("hosted pricing", () => {
  it("publishes Hosted Coach / Hosted Team / Enterprise with Team highlighted", () => {
    assert.equal(PRICING_PLANS.length, 4);
    assert.deepEqual(
      PRICING_PLANS.map((plan) => [plan.id, plan.name, plan.price, plan.cta.label]),
      [
        ["oss", "Open Source", "$0", "Clone on GitHub"],
        ["coach", "Hosted Coach", "$249", "Start Hosted Coach"],
        ["team", "Hosted Team", "$899", "Start Hosted Team"],
        ["enterprise", "Enterprise", "$2,997", "Talk to us"],
      ]
    );
    const team = PRICING_PLANS.find((plan) => plan.id === "team");
    assert.equal(team?.highlighted, true);
    assert.equal(team?.badge, "Most popular");
    assert.equal(PRICING_PLANS[1]?.overageLine, OVERAGE_LINE);
    assert.equal(PRICING_PLANS[2]?.overageLine, OVERAGE_LINE);
    assert.ok(PRICING_PLANS[1]?.features.some((line) => line.includes(`${HOSTED_COACH_EVALS}`)));
    assert.ok(PRICING_PLANS[2]?.features.some((line) => line.includes("1,200")));
    assert.ok(PRICING_PLANS[3]?.features.includes(ENTERPRISE_SEATS_BULLET));
    assert.equal(PRICING_PLANS[1]?.cta.href, "/app/sign-up");
    assert.equal(PRICING_PLANS[2]?.cta.href, "/app/sign-up");
    assert.equal(PRICING_PLANS[0]?.cta.href, GITHUB_REPO_URL);
    assert.equal(PRICING_PLANS[3]?.cta.href, CONTACT_MAILTO);
  });

  it("keeps duration + FAQ copy exact", () => {
    assert.match(PRICING_DURATION_NOTE, /60 minutes/);
    assert.match(PRICING_DURATION_NOTE, /30-minute block/);
    assert.equal(PRICING_FAQS[0]?.question, "What happens if we exceed our monthly evaluations?");
    assert.match(PRICING_FAQS[0]?.answer || "", /\$0\.85\/call/);
    assert.equal(PRICING_FAQS[1]?.question, "Enterprise fair use");
    assert.match(PRICING_FAQS[1]?.answer || "", /4,000 monthly calls/);
    assert.equal(GITHUB_REPO_URL, "https://github.com/Yz613/Sales-Coach");
    assert.match(LICENSE_URL, /LICENSE$/);
    assert.equal(CONTACT_EMAIL, "yehuda@refreshqueue.com");
  });
});

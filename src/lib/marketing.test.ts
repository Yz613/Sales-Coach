import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CONTACT_EMAIL,
  CONTACT_MAILTO,
  GITHUB_REPO_URL,
  LICENSE_URL,
  PRICING_PLANS,
} from "./marketing";

describe("hosted pricing", () => {
  it("publishes the four tiers with Cloud Pro highlighted", () => {
    assert.equal(PRICING_PLANS.length, 4);
    assert.deepEqual(
      PRICING_PLANS.map((plan) => [plan.id, plan.price, plan.cta.label]),
      [
        ["oss", "$0", "Clone on GitHub"],
        ["starter", "$249", "Start Starter"],
        ["pro", "$699", "Start Pro"],
        ["enterprise", "$1,999", "Talk to us"],
      ]
    );
    const pro = PRICING_PLANS.find((plan) => plan.id === "pro");
    assert.equal(pro?.highlighted, true);
    assert.equal(pro?.badge, "Most popular");
    assert.equal(pro?.period, "/mo");
    assert.equal(PRICING_PLANS[1]?.cta.href, "/sign-up");
    assert.equal(PRICING_PLANS[2]?.cta.href, "/sign-up");
    assert.equal(PRICING_PLANS[0]?.cta.href, GITHUB_REPO_URL);
    assert.equal(PRICING_PLANS[3]?.cta.href, CONTACT_MAILTO);
  });

  it("points CTAs at GitHub, LICENSE, and the published contact", () => {
    assert.equal(GITHUB_REPO_URL, "https://github.com/Yz613/Sales-Coach");
    assert.match(LICENSE_URL, /LICENSE$/);
    assert.equal(CONTACT_EMAIL, "yehuda@refreshqueue.com");
    assert.equal(CONTACT_MAILTO, "mailto:yehuda@refreshqueue.com");
  });
});

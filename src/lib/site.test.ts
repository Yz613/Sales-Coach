import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PRICING, annualTotal, formatUsd } from "./site";

describe("hosted pricing", () => {
  it("charges 10 months for annual (two months free)", () => {
    assert.equal(PRICING.annualMonthsCharged, 10);
    assert.equal(annualTotal(PRICING.starterMonthly), 4990);
    assert.equal(annualTotal(PRICING.growthMonthly), 14990);
    assert.equal(formatUsd(499), "$499");
  });
});

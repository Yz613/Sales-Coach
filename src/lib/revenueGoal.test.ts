import assert from "node:assert/strict";
import { formatGroupedNumber, parseGroupedNumber, planRevenueGoal } from "./revenueGoal";

const plan = planRevenueGoal({
  revenue: 500_000,
  averageRevenue: 10_000,
  closeRatePercent: 3,
  sellingDaysPerWeek: 5,
  repCount: 4,
});

assert.ok(plan);
assert.equal(plan.customers, 50);
assert.equal(plan.callsQuarter, Math.ceil(50 / 0.03));
assert.equal(plan.callsWeek, Math.ceil(plan.callsQuarter / 13));
assert.equal(plan.callsDay, Math.ceil(plan.callsWeek / 5));
assert.equal(plan.callsPerRepDay, Math.ceil(plan.callsDay / 4));

assert.equal(planRevenueGoal({ revenue: 0, averageRevenue: 10, closeRatePercent: 3, sellingDaysPerWeek: 5, repCount: 1 }), null);
assert.equal(planRevenueGoal({ revenue: 100, averageRevenue: 10, closeRatePercent: 0, sellingDaysPerWeek: 5, repCount: 1 }), null);

assert.equal(formatGroupedNumber("500000"), "500,000");
assert.equal(formatGroupedNumber("500,000"), "500,000");
assert.equal(formatGroupedNumber("10.555"), "10.55");
assert.equal(formatGroupedNumber("000"), "0");
assert.equal(parseGroupedNumber("500,000"), 500000);
assert.equal(parseGroupedNumber(""), 0);

console.log("revenue goal checks passed");

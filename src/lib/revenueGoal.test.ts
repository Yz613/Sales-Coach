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

const base = { revenue: 50_000, averageRevenue: 1_000, closeRatePercent: 5, sellingDaysPerWeek: 5, repCount: 2 };
const quarter = planRevenueGoal({ ...base, period: "quarter" })!;
const month = planRevenueGoal({ ...base, period: "month" })!;
const week = planRevenueGoal({ ...base, period: "week" })!;
assert.equal(quarter.callsPeriod, 1_000);
assert.equal(month.callsPeriod, 1_000);
assert.equal(week.callsPeriod, 1_000);
assert.equal(quarter.callsWeek, 77);
assert.equal(month.callsWeek, 231);
assert.equal(week.callsWeek, 1_000);
assert.equal(week.callsPerRepDay, 100);
assert.equal(planRevenueGoal({ ...base, repCount: 4, period: "week" })?.callsPerRepDay, 50);
for (const invalid of [
  { repCount: 0 }, { repCount: 1.5 }, { sellingDaysPerWeek: 0 }, { sellingDaysPerWeek: 8 },
  { revenue: Infinity }, { averageRevenue: NaN }, { closeRatePercent: 101 },
]) assert.equal(planRevenueGoal({ ...base, ...invalid }), null);
assert.equal(planRevenueGoal({ ...base, period: "constructor" as "week" }), null);

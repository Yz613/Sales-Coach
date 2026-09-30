import assert from "node:assert/strict";
import { buildGoalReps, createGoalTeam, goalTeamMetrics, readGoalTeams, validateGoalTeams } from "./goalTeams";

const reps = buildGoalReps([{ id: "a", name: "Rep A" }, { id: "b", name: "Rep B" }, { id: "new", name: "New rep" }], [
  ...Array.from({ length: 20 }, (_, i) => ({ repId: "a", coreOutcome: i === 0 ? "Meeting booked" : "Dropped" })),
  ...Array.from({ length: 20 }, (_, i) => ({ repId: "b", coreOutcome: i < 2 ? "Meeting booked" : "Dropped" })),
]);
const core = { ...createGoalTeam("core", "Core team", ["a", "b"]), revenue: 20_000, averageRevenue: 1_000, period: "week" as const };
const metrics = goalTeamMetrics(core, reps);
assert.equal(metrics.loggedCalls, 40);
assert.equal(metrics.closeRate, 7.5);
assert.equal(metrics.repCount, 2);
assert.equal(metrics.repPlans[0].closeRate, 5);
assert.equal(metrics.repPlans[1].closeRate, 10);
assert.equal(metrics.repPlans[0].plan?.callsPeriod, 200);
assert.equal(metrics.repPlans[1].plan?.callsPeriod, 100);
assert.equal(metrics.repPlans[0].plan?.callsDay, 40);
assert.equal(metrics.repPlans[1].plan?.callsDay, 20);

const overridden = goalTeamMetrics({ ...core, repCount: 4 }, reps);
assert.equal(overridden.repCount, 4);
assert.equal(overridden.repPlans[0].revenue, 5_000);
assert.equal(overridden.repPlans[0].plan?.callsPeriod, 100);
assert.equal(overridden.repPlans[1].plan?.callsPeriod, 50);
assert.equal(overridden.plan?.callsPerRepDay, Math.ceil(metrics.plan!.callsDay / 4));

const other = { ...core, id: "other", name: "Other team", repIds: ["b"] };
const aOnly = { ...core, repIds: ["a"] };
assert.equal(goalTeamMetrics(aOnly, reps).closeRate, 5);
assert.equal(goalTeamMetrics(other, reps).closeRate, 10);
assert.equal(goalTeamMetrics(aOnly, reps).plan?.callsPeriod, 400);
assert.equal(goalTeamMetrics(other, reps).plan?.callsPeriod, 200);
assert.deepEqual(validateGoalTeams([aOnly, other], reps.map((rep) => rep.id)), [aOnly, other]);

const newTeam = { ...core, repIds: ["new"] };
assert.equal(goalTeamMetrics(newTeam, reps).plan, null);
assert.equal(goalTeamMetrics(newTeam, reps).repPlans[0].plan, null);
const zeroRate = [{ id: "a", name: "Rep A", loggedCalls: 20, bookedCalls: 0 }];
assert.equal(goalTeamMetrics(aOnly, zeroRate).plan, null);
assert.equal(goalTeamMetrics({ ...aOnly, repIds: [] }, reps).repCount, 0);
assert.equal(goalTeamMetrics({ ...aOnly, repIds: [] }, reps).plan, null);

const validIds = reps.map((rep) => rep.id);
assert.throws(() => validateGoalTeams([core, other], validIds), /only one/);
assert.throws(() => validateGoalTeams([{ ...core, repIds: ["foreign"] }], validIds), /workspace/);
assert.throws(() => validateGoalTeams([{ ...core, repIds: ["a", "a"] }], validIds), /only one/);
assert.throws(() => validateGoalTeams([{ ...core, period: "year" }], validIds), /quarter, month, or week/);
assert.throws(() => validateGoalTeams([{ ...core, repCount: 0 }], validIds), /rep count/);
assert.throws(() => validateGoalTeams([{ ...core, repCount: 1.5 }], validIds), /rep count/);
assert.throws(() => validateGoalTeams([{ ...core, revenue: Infinity }], validIds), /revenue/);
assert.throws(() => validateGoalTeams([{ ...core, sellingDaysPerWeek: 8 }], validIds), /selling days/);
assert.throws(() => validateGoalTeams([{ ...core, name: " " }], validIds), /unique name/);
assert.throws(() => validateGoalTeams([aOnly, { ...other, name: "CORE TEAM" }], validIds), /unique name/);
assert.throws(() => validateGoalTeams([aOnly, { ...other, id: "core" }], validIds), /unique id/);
assert.throws(() => validateGoalTeams([], validIds), /between/);
const withFakeRate = { ...core, closeRate: 99, repCloseRates: { a: 99 } };
assert.deepEqual(validateGoalTeams([withFakeRate], validIds), [core], "supplied close rates are not saved");

assert.deepEqual(readGoalTeams(JSON.stringify([core, { ...other, repIds: [] }]), reps), [core, { ...other, repIds: [] }]);
assert.deepEqual(readGoalTeams(JSON.stringify([core]), [{ id: "a" }])[0].repIds, ["a"], "deleted reps are pruned");
assert.deepEqual(readGoalTeams(null, reps)[0].repIds, validIds);
assert.equal(readGoalTeams("bad json", reps)[0].name, "Core team");
console.log("goal team checks passed");

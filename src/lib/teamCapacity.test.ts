import assert from "node:assert/strict";
import { applySeatLimit, CLERK_INCLUDED_SEAT_CAP, UNLIMITED_TEAM_SEATS } from "./teamCapacity";

async function limitsFor(current: number, rejectUnlimited = false): Promise<number[]> {
  const calls: number[] = [];
  await applySeatLimit(current, async (limit) => {
    calls.push(limit);
    if (rejectUnlimited && limit === UNLIMITED_TEAM_SEATS) {
      throw new Error("plan does not allow unlimited memberships");
    }
  });
  return calls;
}

async function main(): Promise<void> {
  assert.deepEqual(await limitsFor(UNLIMITED_TEAM_SEATS), []);
  assert.deepEqual(await limitsFor(5), [UNLIMITED_TEAM_SEATS]);
  assert.deepEqual(await limitsFor(5, true), [UNLIMITED_TEAM_SEATS, CLERK_INCLUDED_SEAT_CAP]);
  assert.deepEqual(await limitsFor(CLERK_INCLUDED_SEAT_CAP, true), []);
  assert.deepEqual(await limitsFor(50, true), []);

  console.log("team capacity checks passed");
}

void main();

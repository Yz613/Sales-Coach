import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getSetting, setSetting } from "./service";
import { getDb } from "./index";
import { runWithTenant } from "../tenant";
import { createGoalTeam, GOAL_TEAMS_SETTING_KEY, readGoalTeams } from "../goalTeams";

async function run() {
  const original = process.cwd();
  const originalDatabase = process.env.SALES_COACH_DB_PATH;
  const temporary = mkdtempSync(join(tmpdir(), "sales-coach-goals-"));
  copyFileSync(join(original, "schema.sql"), join(temporary, "schema.sql"));
  process.chdir(temporary);
  process.env.SALES_COACH_DB_PATH = join(temporary, "test.db");
  try {
    const teams = [{ ...createGoalTeam("core", "Core team", ["rep-a"]), revenue: 10_000, repCount: 4 }, createGoalTeam("growth", "Growth team", ["rep-b"])];
    await runWithTenant("org_a", async () => {
      await setSetting(GOAL_TEAMS_SETTING_KEY, JSON.stringify(teams));
      assert.deepEqual(readGoalTeams(await getSetting(GOAL_TEAMS_SETTING_KEY), [{ id: "rep-a" }, { id: "rep-b" }]), teams);
    });
    await runWithTenant("org_b", async () => {
      assert.equal(await getSetting(GOAL_TEAMS_SETTING_KEY), null, "another workspace cannot read team goals");
      await setSetting(GOAL_TEAMS_SETTING_KEY, JSON.stringify([createGoalTeam("core", "Their team")]));
    });
    await runWithTenant("org_a", async () => {
      assert.deepEqual(JSON.parse((await getSetting(GOAL_TEAMS_SETTING_KEY))!), teams, "another workspace cannot overwrite goals");
    });
  } finally {
    getDb().$client.close();
    process.chdir(original);
    if (originalDatabase === undefined) delete process.env.SALES_COACH_DB_PATH;
    else process.env.SALES_COACH_DB_PATH = originalDatabase;
    rmSync(temporary, { recursive: true, force: true });
  }
}
run().then(() => console.log("goal team persistence checks passed")).catch((err) => { console.error(err); process.exitCode = 1; });

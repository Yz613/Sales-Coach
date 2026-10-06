import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { getSetting, setSetting, compareAndSetSetting } from "./db/service";
import { runWithTenant } from "./tenant";
import { utcMonthKey } from "./billing";
import { recordEvaluationUsage, QuotaExceededError } from "./billingQuota";

process.env.BILLING_REQUIRED = "true";
delete process.env.BILLING_EXEMPT_ORG_IDS;
const orgId = "org_billing_concurrency";
const auth = { isClerkConfigured: true, orgId, clerkPlanId: "coach" as const };
const key = `billing:usage:${utcMonthKey()}`;

async function worker(): Promise<void> {
  await runWithTenant(orgId, async () => {
    let accepted = 0;
    for (let i = 0; i < 20; i++) {
      try { await recordEvaluationUsage(auth, 1); accepted++; }
      catch (error) { if (!(error instanceof QuotaExceededError)) throw error; }
    }
    console.log(accepted);
  });
}

function child(): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, ["--import", "tsx", fileURLToPath(import.meta.url), "--usage-worker"], {
      env: process.env, stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    let errors = "";
    proc.stdout.on("data", chunk => { output += chunk; });
    proc.stderr.on("data", chunk => { errors += chunk; });
    proc.on("error", reject);
    proc.on("close", code => code === 0 ? resolve(Number(output.trim())) : reject(new Error(errors)));
  });
}

async function run(): Promise<void> {
  assert.ok(process.env.SALES_COACH_DB_PATH, "Run via npm test with an isolated database");
  await runWithTenant(orgId, async () => {
    await setSetting("billing:plan", "coach");
    await setSetting("billing:eval_limit", "10");
    await setSetting("billing:overage_opt_in", "true");
    // Leave the usage row absent: concurrent initial insertion must also be safe.
    assert.equal(await getSetting(key), null);
    assert.deepEqual(await Promise.all(Array.from({ length: 4 }, child)), [20, 20, 20, 20]);
    assert.deepEqual(JSON.parse((await getSetting(key))!), {
      month: utcMonthKey(), creditsUsed: 80, overageCredits: 70, overageAmountUsd: 87.5,
    });
    assert.equal(await compareAndSetSetting(key, null, "{}"), false);
    await setSetting(key, JSON.stringify({ month: utcMonthKey(), creditsUsed: 0, overageCredits: 0, overageAmountUsd: 0 }));
    await setSetting("billing:overage_opt_in", "false");
    const accepted = await Promise.all(Array.from({ length: 4 }, child));
    assert.equal(accepted.reduce((sum, value) => sum + value, 0), 10);
    assert.equal(JSON.parse((await getSetting(key))!).creditsUsed, 10);
    await runWithTenant("org_billing_other", async () => assert.equal(await getSetting(key), null));
  });
  console.log("cross-process billing usage checks passed");
}

(process.argv.includes("--usage-worker") ? worker() : run()).catch(error => { console.error(error); process.exitCode = 1; });

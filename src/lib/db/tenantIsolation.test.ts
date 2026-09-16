import assert from "node:assert/strict";
import {
  getAllCalls,
  getCallById,
  getGlobalSetting,
  getOrCreateRep,
  getSetting,
  insertCall,
  setGlobalSetting,
  setSetting,
} from "./service";
import { loadBillingAccount, saveBillingSettings } from "../billingQuota";
import { claimPendingCheckout } from "../stripeCheckout";
import { runWithTenant } from "../tenant";

async function run(): Promise<void> {
  const stamp = Date.now().toString(36);
  const lockedOrg = `org_locked_${stamp}`;
  const randomOrg = `org_random_${stamp}`;

  const lockedCallId = await runWithTenant(lockedOrg, async () => {
    const repId = await getOrCreateRep(undefined, "Locked Rep", "AE", `locked-${stamp}@example.com`);
    const callId = `call_locked_${stamp}`;
    await insertCall({
      id: callId,
      repId,
      prospectCompany: "Locked Account Co",
      prospectName: "Secret Prospect",
      callStage: "Cold Call",
      coreOutcome: "Dropped",
      durationSeconds: 120,
      transcriptText: "Rep: Hi, this is the locked account transcript.\nProspect: Not now.",
      status: "completed",
      createdAt: new Date().toISOString(),
    });
    await setSetting("ai_api_key", `secret-locked-${stamp}`);
    const mine = await getAllCalls();
    assert.equal(mine.some((c) => c.id === callId), true, "locked org sees its own call");
    return callId;
  });

  await runWithTenant(randomOrg, async () => {
    const leaked = await getAllCalls();
    assert.equal(
      leaked.some((c) => c.id === lockedCallId || /Locked Account Co/.test(c.prospectCompany)),
      false,
      "new org must not see locked-account calls"
    );
    assert.equal(await getCallById(lockedCallId), null, "call id from another org is not readable");
    assert.equal(await getSetting("ai_api_key"), null, "API keys are per-tenant");

    const colliding = await getOrCreateRep(
      undefined,
      "Locked Rep",
      "AE",
      `locked-${stamp}@example.com`
    );
    const lockedRepStillTheirs = await runWithTenant(lockedOrg, async () => {
      const calls = await getAllCalls();
      return calls.find((c) => c.id === lockedCallId)?.repId;
    });
    assert.notEqual(colliding, lockedRepStillTheirs, "same email does not attach to another tenant's rep");

    const prevBilling = process.env.BILLING_REQUIRED;
    process.env.BILLING_REQUIRED = "true";
    try {
      const account = await loadBillingAccount({
        isClerkConfigured: true,
        orgId: randomOrg,
      });
      assert.equal(account.paid, false, "new hosted org is unpaid until checkout");
      const after = await saveBillingSettings(
        { isClerkConfigured: true, orgId: randomOrg },
        { overageOptIn: true }
      );
      assert.equal(after.paid, false, "settings cannot self-select a paid plan");
    } finally {
      if (prevBilling === undefined) delete process.env.BILLING_REQUIRED;
      else process.env.BILLING_REQUIRED = prevBilling;
    }
  });

  const prevBilling = process.env.BILLING_REQUIRED;
  process.env.BILLING_REQUIRED = "true";
  try {
    const paidSessionId = `cs_paid_${stamp}`;
    await setGlobalSetting(
      `stripe:session:${paidSessionId}`,
      JSON.stringify({
        sessionId: paidSessionId,
        planId: "coach",
        status: "paid",
        email: `buyer-${stamp}@example.com`,
        updatedAt: new Date().toISOString(),
      })
    );
    const claimed = await claimPendingCheckout({
      orgId: randomOrg,
      email: `buyer-${stamp}@example.com`,
      sessionId: paidSessionId,
    });
    assert.equal(claimed, "coach");
    await runWithTenant(randomOrg, async () => {
      const account = await loadBillingAccount({
        isClerkConfigured: true,
        orgId: randomOrg,
      });
      assert.equal(account.paid, true, "paid Stripe session activates the new org only");
      assert.equal(account.planId, "coach");
    });
    await runWithTenant(lockedOrg, async () => {
      const locked = await loadBillingAccount({
        isClerkConfigured: true,
        orgId: lockedOrg,
      });
      assert.equal(locked.paid, false, "Stripe claim does not entitle another org");
    });
    const stored = await getGlobalSetting(`stripe:session:${paidSessionId}`);
    assert.match(stored || "", new RegExp(randomOrg));
  } finally {
    if (prevBilling === undefined) delete process.env.BILLING_REQUIRED;
    else process.env.BILLING_REQUIRED = prevBilling;
  }
}

run()
  .then(() => console.log("tenantIsolation checks passed"))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

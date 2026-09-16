import assert from "node:assert/strict";
import { db } from "./index";
import { calls, evaluations, reps } from "./schema";
import { deleteCallsWithoutTranscript, getOrCreateRep } from "./service";
import { LOCAL_TENANT_ID, runWithTenant } from "../tenant";
import { eq } from "drizzle-orm";

async function run(): Promise<void> {
  await runWithTenant(LOCAL_TENANT_ID, async () => {
    const stamp = Date.now().toString(36);
    const repId = await getOrCreateRep(
      undefined,
      `Cleanup Rep ${stamp}`,
      "AE",
      `cleanup-${stamp}@example.com`
    );
    const rep = await db.select().from(reps).where(eq(reps.id, repId)).get();
    assert.ok(rep, "test should create a tenant-scoped rep");

    const badId = `call_unusable_${stamp}`;
    const goodId = `call_usable_${stamp}`;
    const now = new Date().toISOString();

    await db.insert(calls).values({
      id: badId,
      orgId: LOCAL_TENANT_ID,
      repId: rep.id,
      prospectCompany: "Stub Co",
      prospectName: "No Transcript",
      callStage: "Cold Call",
      coreOutcome: "Dropped",
      durationSeconds: 300,
      transcriptText:
        "[Audio file ingested: demo.mp3 (12 KB). Automatic transcription is not configured, so paste the transcript for a full evaluation.]",
      status: "completed",
      createdAt: now,
    }).run();

    await db.insert(evaluations).values({
      id: `eval_${badId}`,
      orgId: LOCAL_TENANT_ID,
      callId: badId,
      repId: rep.id,
      bottomLine: "There is no transcription to review.",
      painStatus: "Fail",
      painEvidence: "n/a",
      budgetStatus: "Fail",
      budgetEvidence: "n/a",
      decisionStatus: "Fail",
      decisionEvidence: "n/a",
      scriptAdherenceScore: 1,
      scriptFeedback: "No transcript",
      missedOpportunities: "[]",
      topFixes: "[]",
      createdAt: now,
    }).run();

    await db.insert(calls).values({
      id: goodId,
      orgId: LOCAL_TENANT_ID,
      repId: rep.id,
      prospectCompany: "Real Co",
      prospectName: "Jane",
      callStage: "Cold Call",
      coreOutcome: "Dropped",
      durationSeconds: 40,
      transcriptText: "Rep: Hi Jane, this is Alex.\nJane: We already have a vendor.",
      status: "completed",
      createdAt: now,
    }).run();

    const removed = await deleteCallsWithoutTranscript();
    assert.ok(removed.includes(badId), `expected ${badId} to be removed, got ${removed.join(",")}`);

    const gone = await db.select().from(calls).where(eq(calls.id, badId)).get();
    const kept = await db.select().from(calls).where(eq(calls.id, goodId)).get();
    const evalGone = await db.select().from(evaluations).where(eq(evaluations.callId, badId)).get();
    assert.equal(gone, undefined);
    assert.ok(kept);
    assert.equal(evalGone, undefined);

    await db.delete(calls).where(eq(calls.id, goodId)).run();
    await db.delete(reps).where(eq(reps.id, rep.id)).run();
  });
}

run()
  .then(() => console.log("cleanupCalls checks passed"))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

import assert from "node:assert/strict";
import { db } from "./index";
import { calls, evaluations, reps } from "./schema";
import { deleteCallsWithoutTranscript } from "./service";
import { eq } from "drizzle-orm";

async function run(): Promise<void> {
  const rep = await db.select().from(reps).limit(1).get();
  assert.ok(rep, "seeded local SQLite should have a rep");

  const badId = `call_unusable_${Date.now()}`;
  const goodId = `call_usable_${Date.now()}`;
  const now = new Date().toISOString();

  await db.insert(calls).values({
    id: badId,
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
}

run()
  .then(() => console.log("cleanupCalls checks passed"))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

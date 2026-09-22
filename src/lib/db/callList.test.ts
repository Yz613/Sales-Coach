import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { calls, evaluations, reps } from "./schema";
import { getAllCalls, getAllReps, getCallById, getOrCreateRep, getSuperAdminReport } from "./service";
import { runWithTenant } from "../tenant";

async function run(): Promise<void> {
  const stamp = Date.now().toString(36);
  const org = `org_speed_${stamp}`;

  await runWithTenant(org, async () => {
    const repId = await getOrCreateRep(undefined, `Speed Rep ${stamp}`, "AE", `speed-${stamp}@example.com`);
    const badId = `call_bad_${stamp}`;
    const hugeId = `call_huge_${stamp}`;
    const now = new Date().toISOString();

    await db.insert(calls).values({
      id: badId,
      orgId: org,
      repId,
      prospectCompany: "Stub Co",
      prospectName: "No Transcript",
      callStage: "Cold Call",
      coreOutcome: "Dropped",
      durationSeconds: 30,
      transcriptText:
        "[Audio file ingested: demo.mp3 (12 KB). Automatic transcription is not configured, so paste the transcript for a full evaluation.]",
      status: "completed",
      createdAt: now,
    }).run();

    const afterPurge = await getAllCalls();
    assert.equal(afterPurge.some((call) => call.id === badId), false, "unusable transcripts are still removed");

    const line = "Rep: We should dig into the budget before pitching.\n";
    const transcriptText = line.repeat(20_000);
    await db.insert(calls).values({
      id: hugeId,
      orgId: org,
      repId,
      prospectCompany: "Big Co",
      prospectName: "Pat",
      callStage: "Cold Call",
      coreOutcome: "Dropped",
      durationSeconds: 600,
      transcriptText,
      status: "completed",
      createdAt: now,
    }).run();

    await db.insert(evaluations).values({
      id: `eval_${hugeId}`,
      orgId: org,
      callId: hugeId,
      repId,
      bottomLine: "Folded.",
      painStatus: "Fail",
      painEvidence: "n/a",
      budgetStatus: "Fail",
      budgetEvidence: "n/a",
      decisionStatus: "Fail",
      decisionEvidence: "n/a",
      scriptAdherenceScore: 3,
      scriptFeedback: "Left the script",
      missedOpportunities: JSON.stringify([
        { prospectOpening: "send me an email", repSurrender: "sure", whatToSayInstead: "stay on" },
      ]),
      topFixes: JSON.stringify([
        { title: "Stay on the call", detail: "Don't fold" },
        { title: "Ask budget", detail: "Ask" },
      ]),
      extendedReview: JSON.stringify({
        scorecard: [{ key: "fightForTheWin", label: "Fight", status: "Fail", score: 2, evidence: "Folded" }],
        walkthrough: [{ step: 1, timestamp: "0:01", timestampSeconds: 1, speaker: "Rep", quote: "sure", whatHappened: "Folded", shouldHaveDone: "Stay", verdict: "miss", category: "objection" }],
        evaluatedWith: { provider: "rules", model: "rules" },
      }),
      createdAt: now,
    }).run();

    const start = performance.now();
    const listed = await getAllCalls();
    await getAllReps();
    const report = await getSuperAdminReport();
    const elapsed = performance.now() - start;

    const huge = listed.find((call) => call.id === hugeId);
    assert.ok(huge, "call list includes the new call");
    assert.equal(huge.transcriptText, "", "call lists must not ship transcript text");
    assert.equal(huge.evaluation?.sandlerBreakdown.pain.status, "Fail");
    assert.equal(huge.evaluation?.walkthrough, undefined, "list payloads omit walkthroughs");
    assert.equal(report.totalCallsReviewed, 1);
    assert.ok(
      elapsed < 1500,
      `listing a ${transcriptText.length}-char transcript took ${elapsed.toFixed(0)}ms`
    );

    const detail = await getCallById(hugeId);
    assert.equal(detail?.transcriptText, transcriptText, "call review still loads the transcript");

    await db.delete(evaluations).where(eq(evaluations.callId, hugeId)).run();
    await db.delete(calls).where(eq(calls.id, hugeId)).run();
    await db.delete(reps).where(eq(reps.id, repId)).run();
    console.log(`call list stayed fast (${elapsed.toFixed(0)}ms) without loading ${transcriptText.length} transcript chars`);
  });
}

run()
  .then(() => console.log("callList checks passed"))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

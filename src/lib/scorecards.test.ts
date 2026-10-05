import assert from "node:assert/strict";
import { after, test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import type { AuthUser } from "./auth";
import {
  answerFromRubric,
  callMatchesFilters,
  canViewScorecard,
  coachingScoreFromAnswer,
  parseFilters,
  weightedOverall,
} from "./scorecardModel";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sales-scorecards-"));
process.env.SALES_COACH_DB_PATH = path.join(dir, "test.db");
after(() => fs.rmSync(dir, { recursive: true, force: true }));

const admin = (tenant: string, email = "manager@example.com"): AuthUser => ({
  userId: "manager", role: "admin", isAdmin: true, isMember: false, isClerkConfigured: true,
  orgId: tenant, canViewAllCalls: true, tenantId: tenant, clerkPlanId: null, billingPaid: true,
  name: "Manager", email,
});

const member = (tenant: string, email: string): AuthUser => ({
  ...admin(tenant, email), userId: "member", role: "member", isAdmin: false, isMember: true, canViewAllCalls: false, name: "Sam",
});

test("weighted overall uses optional weights and leaves unanswered questions out", () => {
  assert.equal(weightedOverall([
    { scale: "pass_fail", value: "pass", weight: 1 },
    { scale: "scale_5", value: "4", weight: 3 },
  ]), 85);
  assert.equal(weightedOverall([
    { scale: "pass_fail", value: "pass", weight: null },
    { scale: "pass_fail", value: "fail", weight: null },
  ]), 50);
  assert.equal(weightedOverall([
    { scale: "pass_fail", value: "pass", weight: 2 },
    { scale: "scale_5", value: null, weight: 5 },
  ]), 100);
  assert.equal(weightedOverall([{ scale: "scale_5", value: null, weight: 1 }]), null);
});

test("filters match team, script, and source only when those selections are set", () => {
  const call = { stage: "Discovery", source: "upload", teamIds: ["east"] };
  assert.equal(callMatchesFilters(parseFilters({}), call), true);
  assert.equal(callMatchesFilters(parseFilters({ stages: ["Discovery"], sources: ["upload"] }), call), true);
  assert.equal(callMatchesFilters(parseFilters({ stages: ["Cold Call"] }), call), false);
  assert.equal(callMatchesFilters(parseFilters({ sources: ["fathom"] }), call), false);
  assert.equal(callMatchesFilters(parseFilters({ teams: ["east"] }), call), true);
  assert.equal(callMatchesFilters(parseFilters({ teams: ["west"] }), call), false);
});

test("visibility hides manager-only scores from the rep", () => {
  assert.equal(canViewScorecard("managers", { manager: false, callRep: true }), false);
  assert.equal(canViewScorecard("managers_and_rep", { manager: false, callRep: true }), true);
  assert.equal(canViewScorecard("call_viewers", { manager: false, callRep: true }), true);
  assert.equal(canViewScorecard("managers", { manager: true, callRep: false }), true);
});

test("rubric results map onto both scales and back onto the coaching score", () => {
  assert.equal(answerFromRubric("pass_fail", { score: 9, status: "Pass" }), "pass");
  assert.equal(answerFromRubric("pass_fail", { score: 2, status: "Fail" }), "fail");
  assert.equal(answerFromRubric("scale_5", { score: null, status: "Incomplete" }), "3");
  assert.equal(answerFromRubric("scale_5", { score: 8, status: "Pass" }), "4");
  assert.equal(coachingScoreFromAnswer("scale_5", "4"), 8);
  assert.equal(coachingScoreFromAnswer("pass_fail", "fail"), 2);
});

test("creating a scorecard, scoring a call, and storing the weighted overall", async () => {
  const { runWithTenant } = await import("./tenant");
  const { getOrCreateRep, insertCall } = await import("./db/service");
  const { saveScorecard, applyScorecardToCall, saveCallScorecardAnswer, listCallScorecards } = await import("./scorecards");
  const { db } = await import("./db");
  const { scorecardApplications } = await import("./db/schema");
  const org = "org-score-store";
  await runWithTenant(org, async () => {
    const repId = await getOrCreateRep(undefined, "Alex Rep", "AE", "alex@example.com");
    const callId = "call-weighted";
    await insertCall({
      id: callId, repId, prospectCompany: "Northwind", prospectName: "Pat", callStage: "Discovery",
      coreOutcome: "Dropped", durationSeconds: 90, transcriptText: "Rep: What is the pain?\nPat: We lose hours every week.",
      status: "completed", createdAt: "2026-10-01T12:00:00.000Z",
    });
    const saved = await saveScorecard("manager", {
      name: "Discovery review",
      visibility: "managers_and_rep",
      autoApply: false,
      questions: [
        { prompt: "Was pain uncovered?", scale: "pass_fail", weight: 1 },
        { prompt: "How deep was discovery?", scale: "scale_5", weight: 3 },
      ],
    });
    await applyScorecardToCall(admin(org), callId, saved.template.id);
    const [first, second] = saved.template.questions;
    await saveCallScorecardAnswer(admin(org), callId, { applicationId: (await listCallScorecards(admin(org), callId)).applications[0].id, questionId: first.id, value: "pass" });
    const viewed = await saveCallScorecardAnswer(admin(org), callId, {
      applicationId: (await listCallScorecards(admin(org), callId)).applications[0].id,
      questionId: second.id,
      value: "4",
      note: "Asked two layers.",
    });
    assert.equal(viewed.applications[0].overallScore, 85);
    assert.equal(viewed.applications[0].answeredCount, 2);
    const stored = await db.select().from(scorecardApplications).where(eq(scorecardApplications.callId, callId)).get();
    assert.equal(stored?.overallScore, 85);
    assert.equal(stored?.orgId, org);
  });
});

test("auto-apply follows team, script, and source filters and stays inside the tenant", async () => {
  const { runWithTenant } = await import("./tenant");
  const { getOrCreateRep, insertCall, setSetting } = await import("./db/service");
  const { saveScorecard, listCallScorecards, autoApplyScorecardsForCall } = await import("./scorecards");
  const { createGoalTeam, GOAL_TEAMS_SETTING_KEY } = await import("./goalTeams");
  const { db } = await import("./db");
  const { callMetadata, scorecardApplications } = await import("./db/schema");
  const org = "org-score-auto";
  const other = "org-score-other";
  let discoveryId = "";
  await runWithTenant(org, async () => {
    const eastRep = await getOrCreateRep(undefined, "East Rep", "AE", "east@example.com");
    const westRep = await getOrCreateRep(undefined, "West Rep", "AE", "west@example.com");
    await setSetting(GOAL_TEAMS_SETTING_KEY, JSON.stringify([
      createGoalTeam("east", "East", [eastRep]),
      { ...createGoalTeam("west", "West", [westRep]) },
    ]));
    await saveScorecard("manager", {
      name: "East discovery uploads",
      visibility: "managers",
      autoApply: true,
      filters: { teams: ["east"], stages: ["Discovery"], sources: ["upload"] },
      questions: [{ prompt: "Up-front contract?", scale: "pass_fail" }],
    });
    await saveScorecard("manager", {
      name: "Fathom only",
      visibility: "call_viewers",
      autoApply: true,
      filters: { sources: ["fathom"] },
      questions: [{ prompt: "Clear next step?", scale: "scale_5", weight: 2 }],
    });
    discoveryId = "call-east-discovery";
    await insertCall({
      id: discoveryId, repId: eastRep, prospectCompany: "East Co", prospectName: "Pat", callStage: "Discovery",
      coreOutcome: "Dropped", durationSeconds: 60, transcriptText: "Rep: Can we spend 15 minutes?\nPat: Yes.",
      status: "completed", createdAt: "2026-10-02T12:00:00.000Z",
    });
    const matched = await listCallScorecards(admin(org), discoveryId);
    assert.equal(matched.applications.length, 1);
    assert.equal(matched.applications[0].templateName, "East discovery uploads");
    assert.equal(matched.applications[0].source, "auto");

    const coldId = "call-east-cold";
    await insertCall({
      id: coldId, repId: eastRep, prospectCompany: "East Co", prospectName: "Pat", callStage: "Cold Call",
      coreOutcome: "Dropped", durationSeconds: 60, transcriptText: "Rep: Is now a bad time?\nPat: A little.",
      status: "completed", createdAt: "2026-10-02T13:00:00.000Z",
    });
    assert.equal((await listCallScorecards(admin(org), coldId)).applications.length, 0);

    const westId = "call-west-discovery";
    await insertCall({
      id: westId, repId: westRep, prospectCompany: "West Co", prospectName: "Jo", callStage: "Discovery",
      coreOutcome: "Dropped", durationSeconds: 60, transcriptText: "Rep: What changed this quarter?\nJo: Headcount.",
      status: "completed", createdAt: "2026-10-02T14:00:00.000Z",
    });
    assert.equal((await listCallScorecards(admin(org), westId)).applications.length, 0);

    const fathomId = "call-fathom";
    await insertCall({
      id: fathomId, repId: eastRep, prospectCompany: "East Co", prospectName: "Pat", callStage: "Discovery",
      coreOutcome: "Dropped", durationSeconds: 60, transcriptText: "Rep: Who else decides?\nPat: Our finance lead.",
      status: "completed", createdAt: "2026-10-02T15:00:00.000Z",
    });
    assert.equal((await listCallScorecards(admin(org), fathomId)).applications.some((item: { templateName: string }) => item.templateName === "Fathom only"), false);
    await db.insert(callMetadata).values({
      callId: fathomId, orgId: org, title: "Fathom import", source: "fathom", createdAt: "2026-10-02T15:00:00.000Z",
    }).run();
    await autoApplyScorecardsForCall(fathomId);
    const fathomCards = await listCallScorecards(admin(org), fathomId);
    assert.equal(fathomCards.applications.some((item: { templateName: string }) => item.templateName === "Fathom only"), true);
  });

  await runWithTenant(other, async () => {
    const repId = await getOrCreateRep(undefined, "Other Rep", "AE", "other@example.com");
    const callId = "call-other-tenant";
    await insertCall({
      id: callId, repId, prospectCompany: "Other Co", prospectName: "Sam", callStage: "Discovery",
      coreOutcome: "Dropped", durationSeconds: 60, transcriptText: "Rep: What is the budget?\nSam: Not sure.",
      status: "completed", createdAt: "2026-10-02T16:00:00.000Z",
    });
    const { listScorecards } = await import("./scorecards");
    assert.equal((await listScorecards()).templates.length, 0);
    await assert.rejects(() => listCallScorecards(admin(other), discoveryId), (error: { status?: number }) => error.status === 404);
    const leaked = await db.select().from(scorecardApplications).where(eq(scorecardApplications.callId, callId)).all();
    assert.equal(leaked.length, 0);
  });
});

test("a rep cannot see manager-only scores, and another tenant cannot read them", async () => {
  const { runWithTenant } = await import("./tenant");
  const { getOrCreateRep, insertCall } = await import("./db/service");
  const { saveScorecard, applyScorecardToCall, listCallScorecards, listScorecards } = await import("./scorecards");
  const org = "org-score-visibility";
  const outsider = "org-score-outsider";
  await runWithTenant(org, async () => {
    const repId = await getOrCreateRep(undefined, "Sam Rep", "AE", "sam@example.com");
    const callId = "call-visibility";
    await insertCall({
      id: callId, repId, prospectCompany: "Visible Co", prospectName: "Sam", callStage: "Discovery",
      coreOutcome: "Dropped", durationSeconds: 45, transcriptText: "Rep: Thanks for the time.\nSam: Sure.",
      status: "completed", createdAt: "2026-10-03T12:00:00.000Z",
    });
    const hidden = await saveScorecard("manager", {
      name: "Manager only", visibility: "managers", autoApply: false,
      questions: [{ prompt: "Held the agenda?", scale: "pass_fail" }],
    });
    const shared = await saveScorecard("manager", {
      name: "Rep can see", visibility: "managers_and_rep", autoApply: false,
      questions: [{ prompt: "Asked for impact?", scale: "scale_5" }],
    });
    await applyScorecardToCall(admin(org), callId, hidden.template.id);
    await applyScorecardToCall(admin(org), callId, shared.template.id);
    const asRep = await listCallScorecards(member(org, "sam@example.com"), callId);
    assert.deepEqual(asRep.applications.map((item: { templateName: string }) => item.templateName), ["Rep can see"]);
    assert.equal(asRep.availableTemplates.length, 0);
    const asManager = await listCallScorecards(admin(org), callId);
    assert.equal(asManager.applications.length, 2);
    assert.equal((await listScorecards()).templates.length, 2);
  });
  await runWithTenant(outsider, async () => {
    assert.equal((await listScorecards()).templates.length, 0);
  });
});

test("linked questions follow the coaching rubric and manager corrections", async () => {
  const { runWithTenant } = await import("./tenant");
  const { getOrCreateRep, insertCall } = await import("./db/service");
  const { saveScorecard, applyScorecardToCall, listCallScorecards, saveCallScorecardAnswer } = await import("./scorecards");
  const { db } = await import("./db");
  const { evaluations, scoreOverrides } = await import("./db/schema");
  const { updateConversation } = await import("./revenue/conversations");
  const org = "org-score-rubric";
  await runWithTenant(org, async () => {
    const repId = await getOrCreateRep(undefined, "Riley Rep", "AE", "riley@example.com");
    const callId = "call-rubric";
    await insertCall({
      id: callId, repId, prospectCompany: "Rubric Co", prospectName: "Riley", callStage: "Discovery",
      coreOutcome: "Dropped", durationSeconds: 80, transcriptText: "Rep: Where does this hurt?\nRiley: Renewals take a week.",
      status: "completed", createdAt: "2026-10-04T12:00:00.000Z",
    });
    await db.insert(evaluations).values({
      id: "eval-rubric", orgId: org, callId, repId, bottomLine: "Pain was named.",
      painStatus: "Pass", painEvidence: "Renewals take a week.", budgetStatus: "Fail", budgetEvidence: "Not asked.",
      decisionStatus: "Fail", decisionEvidence: "Not asked.", scriptAdherenceScore: 8, scriptFeedback: "Mostly followed.",
      missedOpportunities: "[]", topFixes: "[]",
      extendedReview: JSON.stringify({ scorecard: [{ key: "pain", label: "Pain", status: "Pass", score: 9, evidence: "Renewals." }] }),
      createdAt: "2026-10-04T12:05:00.000Z",
    }).run();
    const saved = await saveScorecard("manager", {
      name: "Rubric linked", visibility: "managers", autoApply: false,
      questions: [
        { prompt: "Pain handled?", scale: "pass_fail", rubricKey: "pain" },
        { prompt: "Script score", scale: "scale_5", weight: 1, rubricKey: "scriptAdherence" },
      ],
    });
    await applyScorecardToCall(admin(org), callId, saved.template.id);
    const seeded = await listCallScorecards(admin(org), callId);
    const pain = seeded.applications[0].questions.find((question: { rubricKey: string | null }) => question.rubricKey === "pain");
    const script = seeded.applications[0].questions.find((question: { rubricKey: string | null }) => question.rubricKey === "scriptAdherence");
    if (!pain?.answer || !script?.answer) throw new Error("Rubric answers were not stored.");
    assert.equal(pain.answer.value, "pass");
    assert.equal(pain.answer.origin, "rubric");
    assert.equal(script.answer.value, "4");
    assert.equal(seeded.applications[0].overallScore, 90);

    const call = { id: callId, repId, prospectCompany: "Rubric Co", prospectName: "Riley", callStage: "Discovery", coreOutcome: "Dropped", durationSeconds: 80, transcriptText: "Rep: Where does this hurt?\nRiley: Renewals take a week.", status: "completed" as const, createdAt: "2026-10-04T12:00:00.000Z" };
    await updateConversation(admin(org), call, { action: "override", metricKey: "pain", score: 2, reason: "The pain was assumed." });
    const corrected = await listCallScorecards(admin(org), callId);
    const painAfter = corrected.applications[0].questions.find((question: { rubricKey: string | null }) => question.rubricKey === "pain");
    if (!painAfter?.answer) throw new Error("Corrected answer was not stored.");
    assert.equal(painAfter.answer.value, "fail");
    assert.equal(painAfter.answer.origin, "correction");
    assert.equal(corrected.applications[0].overallScore, 40);

    await saveCallScorecardAnswer(admin(org), callId, {
      applicationId: corrected.applications[0].id, questionId: script.id, value: "5", note: "Stayed on the script.",
    });
    const override = await db.select().from(scoreOverrides).where(eq(scoreOverrides.callId, callId)).all();
    assert.equal(override.some((row: { metricKey: string; score: number }) => row.metricKey === "scriptAdherence" && row.score === 10), true);
  });
});

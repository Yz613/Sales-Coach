import assert from "node:assert/strict";
import {
  CLEF_PRIMARY_MODEL,
  CLEF_MODEL_FIELD,
  CLEF_MAX_QUESTIONS_PER_BATCH,
  evaluateAnswerConfidence,
  normalizeClefAnswer,
  runClefDecisions,
  ClefMalformedResponseError,
  ClefTimeoutError,
  type ClefScoreAnswer,
  type ClefNoulAnswer,
  type ClefQuestion,
} from "./clefDecisionProvider";
import {
  buildClefDecisionState,
  buildClefQuestionsForRubric,
  mapClefAnswersToScorecard,
  statusFromClefScore,
  evaluateCallWithClef,
  CLEF_SCORE_CRITERIA_0_TO_9,
} from "./clefEvaluator";
import {
  buildShadowComparison,
  computeComparisonMetrics,
  formatComparisonReport,
  exportEvaluationDataset,
} from "./clefComparison";
import { methodById } from "../salesMethods";
import { weightedCallScore, weightsForMethod } from "../scoreWeights";
import { hydrateEvaluation } from "../evaluations";
import { evaluateCall } from "./coach";
import { db } from "../db";
import { calls, evaluations, reps, scoreOverrides } from "../db/schema";
import { eq } from "drizzle-orm";
import { updateConversation } from "../revenue/conversations";
import type { AuthUser } from "../auth";

async function runTests() {
  console.log("Running Clef decision engine test suite...");

  // ---------------------------------------------------------------------------
  // 1. Clef request construction & Decision State
  // ---------------------------------------------------------------------------
{
  const sandler = methodById("sandler");
  const state = buildClefDecisionState({
    transcriptText: "Rep: Hi, we sell CRM software.\nProspect: Not interested, send an email.\nRep: Okay, no problem!",
    durationSeconds: 45,
    callStage: "Cold Call",
    repName: "Jordan",
    prospectCompany: "Acme Corp",
    prospectName: "Taylor",
    methodology: sandler,
    coachContext: "Do not let reps fold on 'send an email'.",
  });

  // Verify necessary state context is present
  assert.ok(state.includes("Pipeline Stage: Cold Call"), "Stage must be included");
  assert.ok(state.includes("Acme Corp"), "Prospect company must be included");
  assert.ok(state.includes("Jordan"), "Rep name must be included");
  assert.ok(state.includes("Sandler Selling System"), "Methodology name must be included");
  assert.ok(state.includes("Do not let reps fold"), "Manager directives must be included");
  assert.ok(state.includes("Rep: Hi, we sell CRM software."), "Transcript must be included");

  // Verify sensitive information is strictly absent
  assert.ok(!state.includes("sk-"), "State must never contain OpenAI API keys");
  assert.ok(!state.includes("AIzaSy"), "State must never contain Gemini API keys");
  assert.ok(!state.includes("CLOUDFLARE_API_TOKEN"), "State must never contain Cloudflare tokens");
  assert.ok(!state.includes("weight"), "Weights must not be in Clef state");

  // Dynamic questions generation
  const questions = buildClefQuestionsForRubric(sandler);

  // Check typed questions and 0-10 criteria
  assert.equal(questions.pain?.type, "score");
  assert.deepEqual((questions.pain as any).criteria, CLEF_SCORE_CRITERIA_0_TO_9);
  assert.equal(questions.budget?.type, "score");
  assert.equal(questions.decision?.type, "score");
  assert.equal(questions.scriptAdherence?.type, "score");
  assert.equal(questions.fightForTheWin?.type, "score");
  assert.equal(questions.nextStep?.type, "score");
  assert.equal(questions.discoveryDepth?.type, "score");
  assert.equal(questions.controlAndPacing?.type, "score");
  assert.equal(questions.peerAuthority?.type, "score");
  for (const question of Object.values(questions)) {
    if (question.type === "score") {
      assert.ok(question.criteria.length >= 2 && question.criteria.length <= 10, "Cloudflare score rubrics accept 2–10 levels");
    }
  }

  // Check bounded questions
  assert.equal(questions.early_fold?.type, "noul");
  assert.equal(questions.clear_next_step?.type, "noul");
  assert.equal(questions.buyer_engaged?.type, "score");
  assert.equal(questions.qualification_pain?.type, "score");
  assert.equal(questions.qualification_budget?.type, "score");
  assert.equal(questions.qualification_decision?.type, "score");
  assert.equal(questions.objection_handling?.type, "score");
  assert.equal(questions.discovery_depth?.type, "score");

  // Check methodology micro-skills
  assert.equal(questions.upFrontContract?.type, "score");
  assert.equal(questions.reversing?.type, "score");
  assert.equal(questions.permissionToPivot?.type, "score");
  assert.equal(questions.strippingLine?.type, "score");
  assert.equal(questions.thermometerClose?.type, "score");

  console.log("✔ Clef request construction and state verification passed");
}

// ---------------------------------------------------------------------------
// 2. Dynamic Custom Rubrics (e.g. MEDDIC)
// ---------------------------------------------------------------------------
{
  const meddic = methodById("meddic");
  const questions = buildClefQuestionsForRubric(meddic);

  // MEDDIC pillars are mapped dynamically
  assert.ok(questions.pain, "MEDDIC pain pillar included");
  assert.ok(questions.budget, "MEDDIC budget pillar included");
  assert.ok(questions.decision, "MEDDIC decision pillar included");
  assert.ok(questions.pain.instructions.includes("Metrics"), "MEDDIC instructions reflect its rubric");

  // MEDDIC does not have Sandler micro-skills
  assert.equal(questions.upFrontContract, undefined);
  assert.equal(questions.strippingLine, undefined);

  console.log("✔ Dynamic custom rubrics passed");
}

// ---------------------------------------------------------------------------
// 3. Metric Score Mapping & Deterministic Statuses
// ---------------------------------------------------------------------------
{
  assert.equal(statusFromClefScore(10), "Pass");
  assert.equal(statusFromClefScore(8), "Pass");
  assert.equal(statusFromClefScore(7), "Pass");
  assert.equal(statusFromClefScore(6.9), "Incomplete");
  assert.equal(statusFromClefScore(5), "Incomplete");
  assert.equal(statusFromClefScore(4), "Incomplete");
  assert.equal(statusFromClefScore(3.9), "Fail");
  assert.equal(statusFromClefScore(1), "Fail");
  assert.equal(statusFromClefScore(0), "Fail");

  const sandler = methodById("sandler");
  const mockResult = {
    model: CLEF_PRIMARY_MODEL,
    schemaVersion: "1.0",
    timestamp: "2026-10-04T00:00:00.000Z",
    latencyMs: 140,
    batchesExecuted: 1,
    answers: {
      pain: {
        type: "score" as const,
        score: 8.4,
        probabilities: { "7": 0.1, "8": 0.8, "9": 0.1 },
        confidence: 0.85,
      },
      budget: {
        type: "score" as const,
        score: 4.2,
        probabilities: { "3": 0.2, "4": 0.7, "5": 0.1 },
        confidence: 0.75,
      },
      decision: {
        type: "score" as const,
        score: 2.1,
        probabilities: { "1": 0.2, "2": 0.7, "3": 0.1 },
        confidence: 0.8,
      },
      scriptAdherence: {
        type: "score" as const,
        score: 7.0,
        probabilities: { "7": 0.9 },
        confidence: 0.9,
      },
      early_fold: {
        type: "noul" as const,
        noul: 0.95,
        confidence: 0.9,
      },
      clear_next_step: {
        type: "noul" as const,
        noul: 0.1,
        confidence: 0.8,
      },
    },
  };

  const output = mapClefAnswersToScorecard(mockResult.answers, sandler, mockResult);

  const painMetric = output.scorecard.find((m) => m.key === "pain");
  assert.equal(painMetric?.score, 9);
  assert.equal(painMetric?.status, "Pass");
  assert.deepEqual(painMetric?.probabilities, { "7": 0.1, "8": 0.8, "9": 0.1 });

  const budgetMetric = output.scorecard.find((m) => m.key === "budget");
  assert.equal(budgetMetric?.score, 5);
  assert.equal(budgetMetric?.status, "Incomplete");

  const decisionMetric = output.scorecard.find((m) => m.key === "decision");
  assert.equal(decisionMetric?.score, 2);
  assert.equal(decisionMetric?.status, "Fail");

  assert.equal(output.foldedEarly, true);
  assert.equal(output.clearNextStep, false);
  assert.equal(output.clefMetadata.model, CLEF_PRIMARY_MODEL);

  console.log("✔ Metric score mapping and probability preservation passed");
}

// ---------------------------------------------------------------------------
// 4. Weighting Remains Deterministic
// ---------------------------------------------------------------------------
{
  const sandler = methodById("sandler");
  const mockScores = {
    scriptAdherence: 8,
    pain: 10,
    budget: 0,
    decision: 0,
    fightForTheWin: 8,
    nextStep: 8,
    discoveryDepth: 8,
    controlAndPacing: 8,
    peerAuthority: 8,
    upFrontContract: 8,
    reversing: 8,
    permissionToPivot: 8,
    strippingLine: 8,
    thermometerClose: 8,
  };

  const evenWeights = weightsForMethod({}, sandler);
  const evenTotal = weightedCallScore(mockScores, evenWeights, sandler);

  // High weight on pain
  const painHeavy = weightsForMethod({ pain: 10, budget: 0, decision: 0 }, sandler);
  const painHeavyTotal = weightedCallScore(mockScores, painHeavy, sandler);

  assert.ok(evenTotal !== null && painHeavyTotal !== null);
  assert.ok(painHeavyTotal > evenTotal, "Pain heavy weighted score must reflect deterministic weighting");

  console.log("✔ Weighting remains deterministic passed");
}

// ---------------------------------------------------------------------------
// 5. Uncertainty Handling & Configurable Policy
// ---------------------------------------------------------------------------
{
  // High confidence answer
  const highAns: ClefScoreAnswer = {
    type: "score",
    score: 8.0,
    probabilities: { "8": 0.85, "7": 0.1, "9": 0.05 },
  };
  const highEval = evaluateAnswerConfidence(highAns);
  assert.equal(highEval.level, "high");
  assert.equal(highEval.needsReview, false);

  // Close top probabilities -> needs review
  const closeAns: ClefScoreAnswer = {
    type: "score",
    score: 6.5,
    probabilities: { "6": 0.45, "7": 0.44, "5": 0.11 }, // margin 0.01 < closeMargin 0.10
  };
  const closeEval = evaluateAnswerConfidence(closeAns);
  assert.equal(closeEval.level, "low");
  assert.equal(closeEval.needsReview, true);
  assert.match(closeEval.reason || "", /Close top probabilities/);

  // Noul close to 0.5
  const borderNoul: ClefNoulAnswer = {
    type: "noul",
    noul: 0.52,
  };
  const borderEval = evaluateAnswerConfidence(borderNoul);
  assert.equal(borderEval.level, "low");
  assert.equal(borderEval.needsReview, true);

  console.log("✔ Uncertainty handling passed");
}

// ---------------------------------------------------------------------------
// 6. Malformed Clef Responses & Timeouts
// ---------------------------------------------------------------------------
{
  assert.throws(
    () => normalizeClefAnswer("test", null as any),
    ClefMalformedResponseError,
    "Null answer must throw ClefMalformedResponseError"
  );

  assert.throws(
    () => normalizeClefAnswer("test", { unknownField: true }),
    ClefMalformedResponseError,
    "Unrecognized answer object must throw ClefMalformedResponseError"
  );

  const scoreNorm = normalizeClefAnswer("metric", { score: 7.2, probabilities: { "7": 0.8 } });
  assert.equal((scoreNorm as any).score, 7.2);
  assert.throws(() => normalizeClefAnswer("metric", { score: 9.1 }, { type: "score", instructions: "Fixture", criteria: CLEF_SCORE_CRITERIA_0_TO_9 }), ClefMalformedResponseError);
  for (const [rawScore, expectedScore] of [[0, 0], [4.5, 5], [9, 10]]) {
    const result = { model: CLEF_PRIMARY_MODEL, schemaVersion: "1.1", timestamp: "2026-10-09", latencyMs: 0, batchesExecuted: 1, answers: { pain: { type: "score" as const, score: rawScore, probabilities: { [String(rawScore)]: 1 } } } };
    const mapped = mapClefAnswersToScorecard(result.answers, methodById("sandler"), result);
    assert.equal(mapped.scorecard.find(metric => metric.key === "pain")?.score, expectedScore, "Map provider's 0–9 expected score to the app's 0–10 scale");
    assert.deepEqual(mapped.rawAnswers, result.answers, "Preserve the original provider result for review");
  }

  const noulNorm = normalizeClefAnswer("fold", { noul: 0.88 });
  assert.equal((noulNorm as any).noul, 0.88);

  // Timeout rejection test
  const hangingAiBinding = {
    run: async () => new Promise((resolve) => setTimeout(resolve, 200)),
  };

  await assert.rejects(
    () =>
      runClefDecisions(
        {
          state: "Slow call",
          questions: {
            test_q: { type: "noul", instructions: "Hanging?" },
          },
        },
        { aiBinding: hangingAiBinding, timeoutMs: 30 }
      ),
    (err: any) => err instanceof ClefTimeoutError && err.code === "TIMEOUT",
    "Should reject with ClefTimeoutError when execution exceeds timeout"
  );

  console.log("✔ Malformed Clef response and timeout handling passed");
}

// ---------------------------------------------------------------------------
// 7. 64-Question Batching
// ---------------------------------------------------------------------------
{
  // Construct 75 questions (> 64 questions)
  const manyQuestions: Record<string, ClefQuestion> = {};
  for (let i = 0; i < 75; i++) {
    manyQuestions[`q_${i}`] = {
      type: "score",
      instructions: `Question ${i}`,
      criteria: CLEF_SCORE_CRITERIA_0_TO_9,
    };
  }

  // Mock binding to intercept and verify batch execution
  let batchesSeen: number = 0;
  const mockAiBinding = {
    run: async (model: string, payload: any) => {
      batchesSeen++;
      assert.equal(model, CLEF_PRIMARY_MODEL);
      assert.equal(payload.model, CLEF_MODEL_FIELD);
      assert.ok(
        Object.keys(payload.questions).length <= CLEF_MAX_QUESTIONS_PER_BATCH,
        `Batch size must be <= ${CLEF_MAX_QUESTIONS_PER_BATCH}`
      );

      const answers: Record<string, any> = {};
      for (const question of Object.values(payload.questions) as ClefQuestion[]) {
        if (question.type === "score") assert.ok(question.criteria.length <= 10, "Reject rubrics that the real service rejects");
      }
      for (const k of Object.keys(payload.questions)) {
        answers[k] = { score: 7.0, probabilities: { "7": 1.0 } };
      }
      return { result: { answers } };
    },
  };

  const batchResult = await runClefDecisions(
    {
      state: "Test state",
      questions: manyQuestions,
    },
    { aiBinding: mockAiBinding }
  );

  assert.equal(batchesSeen, 2, "75 questions must be split into 2 batches");
  assert.equal(batchResult.batchesExecuted, 2);
  assert.equal(Object.keys(batchResult.answers).length, 75, "All 75 answers must be merged");

  console.log("✔ 64-question batching passed");
}

// ---------------------------------------------------------------------------
// 8. Primary Mode Evaluation & Fallback Mode
// ---------------------------------------------------------------------------
{
  const sandler = methodById("sandler");

  // Mock binding providing Clef scores
  const mockAiBinding = {
    run: async (_model: string, payload: any) => {
      const answers: Record<string, any> = {};
      for (const k of Object.keys(payload.questions)) {
        if (payload.questions[k].type === "noul") {
          answers[k] = { noul: 0.1 };
        } else {
          answers[k] = { score: 8.0, probabilities: { "8": 0.9, "7": 0.1 } };
        }
      }
      return { result: { answers } };
    },
  };

  const evalResult = await evaluateCallWithClef({
    callId: "call_test",
    repId: "rep_test",
    repName: "Alex",
    transcriptText: "Alex: Hi Taylor. Taylor: Hi Alex. Alex: Let's discuss your shipping bottleneck.",
    callStage: "Discovery",
    prospectCompany: "Beta Inc",
    prospectName: "Taylor",
    methodology: sandler,
    clefOptions: { aiBinding: mockAiBinding },
  });

  assert.equal(evalResult.evaluatedWith?.provider, "clef");
  assert.equal(evalResult.evaluatedWith?.model, CLEF_PRIMARY_MODEL);
  assert.equal(evalResult.sandlerBreakdown.pain.status, "Pass");
  assert.equal(evalResult.sandlerBreakdown.scriptAdherence.score, 9);
  assert.ok(evalResult.scorecard?.length! >= 8);

  console.log("✔ Primary mode Clef evaluation passed");

  // Fallback mode: when Clef fails, evaluateCall falls back to deterministic rule engine
  process.env.CLEF_EVALUATION_MODE = "primary";

  // Insert mock rep and call for evaluateCall
  const stamp = Date.now();
  const testRepId = `rep_fb_${stamp}`;
  const testCallId = `call_fb_${stamp}`;

  await db.insert(reps).values({
    id: testRepId,
    orgId: "local",
    name: "Sam Fallback",
    email: `sam_${stamp}@example.com`,
    role: "AE",
    createdAt: new Date().toISOString(),
  }).run();

  await db.insert(calls).values({
    id: testCallId,
    orgId: "local",
    repId: testRepId,
    prospectCompany: "Fallback Co",
    prospectName: "Jordan",
    callStage: "Discovery",
    coreOutcome: "Dropped",
    durationSeconds: 60,
    transcriptText: "Sam: Hello Jordan. Jordan: I'm busy. Sam: Okay no problem, bye.",
    status: "analyzing",
    createdAt: new Date().toISOString(),
  }).run();

  // In local test environment, without Cloudflare credentials or binding, Clef fails and triggers fallback
  const fallbackResult = await evaluateCall({
    callId: testCallId,
    repId: testRepId,
    transcriptText: "Sam: Hello Jordan. Jordan: I'm busy. Sam: Okay no problem, bye.",
    callStage: "Discovery",
    prospectCompany: "Fallback Co",
    prospectName: "Jordan",
    durationSeconds: 60,
  });

  assert.equal(fallbackResult.evaluatedWith?.provider, "clef");
  assert.equal(fallbackResult.evaluatedWith?.fallback, "rules");
  assert.equal((fallbackResult.evaluatedWith as any)?.degraded, true);
  assert.match(fallbackResult.evaluatedWith?.error || "", /Degraded evaluation/);

  console.log("✔ Fallback mode gracefully fell back to rule engine with degraded notice");
}

// ---------------------------------------------------------------------------
// 9. Shadow Mode & Comparison Data
// ---------------------------------------------------------------------------
{
  const mockLegacyScorecard = [
    { key: "pain" as const, label: "Pain", status: "Pass" as const, score: 8, evidence: "Legacy pass" },
    { key: "budget" as const, label: "Budget", status: "Incomplete" as const, score: 5, evidence: "Legacy budget" },
  ];
  const mockClefScorecard = [
    { key: "pain" as const, label: "Pain", status: "Pass" as const, score: 9, evidence: "Clef pass", confidence: 0.9 },
    { key: "budget" as const, label: "Budget", status: "Fail" as const, score: 3, evidence: "Clef budget", confidence: 0.8 },
  ];
  const mockDetScorecard = [
    { key: "pain" as const, label: "Pain", status: "Incomplete" as const, score: 5, evidence: "Det" },
    { key: "budget" as const, label: "Budget", status: "Fail" as const, score: 2, evidence: "Det" },
  ];

  const shadowCmp = buildShadowComparison({
    legacyScorecard: mockLegacyScorecard,
    legacyScriptScore: 7,
    clefScorecard: mockClefScorecard,
    clefScriptScore: 8,
    deterministicScorecard: mockDetScorecard,
    deterministicScriptScore: 6,
    clefLatencyMs: 180,
    clefModel: CLEF_PRIMARY_MODEL,
    clefConfidence: "high",
  });

  assert.ok(shadowCmp.statusDisagreements.includes("budget"), "Status disagreement on budget detected");
  assert.equal(shadowCmp.clefLatencyMs, 180);
  assert.equal(shadowCmp.clefConfidence, "high");

  // Comparison metrics calculation
  const metrics = await computeComparisonMetrics("local");
  assert.ok(metrics.totalEvaluations >= 1);
  const report = formatComparisonReport(metrics);
  assert.ok(report.includes("CLOUDFLARE CLEF EVALUATION COMPARISON REPORT"));

  console.log("✔ Shadow mode and comparison metrics passed");
}

// ---------------------------------------------------------------------------
// 10. Manager Corrections & Metadata Preservation
// ---------------------------------------------------------------------------
let evalId = "";
{
  const stamp = Date.now();
  const testRepId = `rep_corr_${stamp}`;
  const testCallId = `call_corr_${stamp}`;

  await db.insert(reps).values({
    id: testRepId,
    orgId: "local",
    name: "Morgan Rep",
    email: `morgan_${stamp}@example.com`,
    role: "SDR",
    createdAt: new Date().toISOString(),
  }).run();

  await db.insert(calls).values({
    id: testCallId,
    orgId: "local",
    repId: testRepId,
    prospectCompany: "Override Corp",
    prospectName: "Morgan Prospect",
    callStage: "Cold Call",
    coreOutcome: "Meeting booked",
    durationSeconds: 120,
    transcriptText: "Rep: Hi Morgan. Morgan: Tell me more. Rep: Booked for Friday.",
    status: "completed",
    createdAt: new Date().toISOString(),
  }).run();

  // Create an evaluation with Clef metadata
  evalId = `eval_${stamp}`;
  await db.insert(evaluations).values({
    id: evalId,
    orgId: "local",
    callId: testCallId,
    repId: testRepId,
    bottomLine: "Good call",
    painStatus: "Pass",
    painEvidence: "Uncovered pain",
    budgetStatus: "Incomplete",
    budgetEvidence: "Touched budget",
    decisionStatus: "Pass",
    decisionEvidence: "Locked next step",
    scriptAdherenceScore: 7,
    scriptFeedback: "On sequence",
    missedOpportunities: "[]",
    topFixes: "[]",
    extendedReview: JSON.stringify({
      scorecard: [
        {
          key: "pain",
          label: "Pain",
          status: "Pass",
          score: 8,
          evidence: "Clef pain score",
          probabilities: { "8": 0.85, "7": 0.15 },
          confidence: 0.85,
        },
      ],
      walkthrough: [],
      clefMetadata: {
        model: CLEF_PRIMARY_MODEL,
        schemaVersion: "1.0",
        timestamp: new Date().toISOString(),
        confidence: "high",
      },
    }),
    createdAt: new Date().toISOString(),
  }).run();

  // Apply a manager correction
  const auth: AuthUser = {
    userId: "admin_1",
    role: "admin",
    isAdmin: true,
    isMember: false,
    isClerkConfigured: false,
    orgId: "local",
    tenantId: "local",
    canViewAllCalls: true,
    clerkPlanId: null,
    billingPaid: true,
    name: "VP Sales",
    email: "vp@example.com",
  };

  const callRecord = await db.select().from(calls).where(eq(calls.id, testCallId)).get();
  assert.ok(callRecord);

  await updateConversation(auth, callRecord, {
    action: "override",
    metricKey: "pain",
    score: 10,
    reason: "Verbal agreement was exceptionally strong and personal stake verified.",
  });

  // Verify score_overrides contains preserved Clef metadata
  const override = await db
    .select()
    .from(scoreOverrides)
    .where(eq(scoreOverrides.callId, testCallId))
    .get();

  assert.ok(override);
  assert.equal(override.score, 10);
  assert.equal(override.originalScore, 8);
  assert.equal(override.clefModel, CLEF_PRIMARY_MODEL);
  assert.equal(override.rubricVersion, "1.0");
  assert.ok(override.originalProbabilities?.includes("0.85"));

  // Check exportable evaluation dataset
  const dataset = await exportEvaluationDataset({ orgId: "local" });
  assert.ok(Array.isArray(dataset) && dataset.length > 0);
  const exportedRecord = dataset.find((r) => r.callId === testCallId && r.metricKey === "pain");
  assert.ok(exportedRecord);
  assert.equal(exportedRecord.managerCorrection?.correctedScore, 10);
  assert.equal(exportedRecord.managerCorrection?.originalScore, 8);
  assert.equal(exportedRecord.clefDecision?.score, 8);

    console.log("✔ Manager corrections preserved original decision metadata and export dataset verified");
  }

  // ---------------------------------------------------------------------------
  // 11. Existing evaluation UI continues to function
  // ---------------------------------------------------------------------------
  {
    const evalRow = await db.select().from(evaluations).where(eq(evaluations.id, evalId)).get();
    assert.ok(evalRow);
    const hydrated = hydrateEvaluation(evalRow, {
      repName: "Morgan Rep",
      callStage: "Cold Call",
      coreOutcome: "Meeting booked",
    });

    assert.ok(hydrated.id);
    assert.equal(hydrated.sandlerBreakdown.pain.status, "Pass");
    assert.ok(hydrated.scorecard && hydrated.scorecard.length > 0);
    assert.equal(hydrated.scorecard[0].score, 8);
    assert.equal(hydrated.scorecard[0].status, "Pass");
    assert.equal(hydrated.scorecard[0].confidence, 0.85);
    assert.equal(hydrated.coreOutcome, "Meeting booked");
    console.log("✔ Existing evaluation UI data structures continue to function seamlessly");
  }

  console.log("\nAll Clef decision engine tests completed successfully!");
}

runTests().catch((err) => {
  console.error("Clef test failed:", err);
  process.exit(1);
});

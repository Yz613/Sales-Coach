import assert from "node:assert/strict";
import {
  hydrateEvaluation,
  latestEvaluationRow,
  latestEvaluationsByCall,
  usedLlmReview,
  type EvaluationRow,
} from "./evaluations";

const base: EvaluationRow = {
  id: "eval_1",
  callId: "call_1",
  repId: "rep_1",
  bottomLine: "Folded early",
  painStatus: "Fail",
  painEvidence: "Never asked about pain",
  budgetStatus: "Incomplete",
  budgetEvidence: "Budget not discussed",
  decisionStatus: "Incomplete",
  decisionEvidence: "No next step",
  scriptAdherenceScore: 4,
  scriptFeedback: "Left the sequence",
  createdAt: "2026-09-09T00:00:00.000Z",
};

const extras = {
  repName: "Isaac",
  callStage: "Cold Call",
  coreOutcome: "No next step",
};

const badJson = hydrateEvaluation(
  {
    ...base,
    missedOpportunities: "not-json",
    topFixes: "{",
    scriptDivergence: "oops",
    extendedReview: "nope",
  },
  extras
);
assert.deepEqual(badJson.missedOpportunities, []);
assert.deepEqual(badJson.topFixes, []);
assert.equal(badJson.scriptDivergence, undefined);
assert.equal(badJson.walkthrough, undefined);

const good = hydrateEvaluation(
  {
    ...base,
    missedOpportunities: "[]",
    topFixes: "[]",
    scriptDivergence: '{"offScript":[]}',
    extendedReview: '{"scorecard":[],"walkthrough":[]}',
  },
  extras
);
assert.deepEqual(good.scriptDivergence, { offScript: [] });
assert.deepEqual(good.walkthrough, []);

const older = { ...base, id: "eval_old", createdAt: "2026-09-01T00:00:00.000Z" };
const newer = { ...base, id: "eval_new", createdAt: "2026-09-10T12:00:00.000Z" };
const other = { ...base, id: "eval_other", callId: "call_2", createdAt: "2026-09-11T00:00:00.000Z" };
assert.equal(latestEvaluationRow([older, newer, other], "call_1"), newer);
assert.equal(latestEvaluationsByCall([older, other, newer])[0], other);
assert.deepEqual(
  latestEvaluationsByCall([older, other, newer]).map((row) => row.callId),
  ["call_2", "call_1"]
);
assert.equal(usedLlmReview(undefined), false);
assert.equal(usedLlmReview({ evaluatedWith: undefined }), false);
assert.equal(usedLlmReview({ evaluatedWith: { provider: "openai" } }), true);

console.log("evaluations checks passed");

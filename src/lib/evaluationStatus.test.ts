import assert from "node:assert/strict";
import test from "node:test";
import { evaluationDisplay, isDialLog, resolveNewCallStatus } from "./evaluationStatus";

test("dial logs are not applicable and never analyzing", () => {
  const dial = { audioUrl: null, transcriptText: "", status: "analyzing" };
  assert.equal(isDialLog(dial), true);
  assert.equal(resolveNewCallStatus(dial), "not_applicable");
  assert.equal(evaluationDisplay({ status: "not_applicable", createdAt: new Date().toISOString() }), "not_applicable");
});

test("a pasted transcript without audio can still be analyzed", () => {
  const pasted = { audioUrl: undefined, transcriptText: "Rep: What is the budget?\nPat: We have one.", status: "analyzing" };
  assert.equal(isDialLog(pasted), false);
  assert.equal(resolveNewCallStatus(pasted), "analyzing");
});

test("analyzing older than 30 minutes without a live job is failed", () => {
  const createdAt = new Date(Date.now() - 31 * 60 * 1000).toISOString();
  assert.equal(evaluationDisplay({ status: "analyzing", createdAt, hasLiveJob: false }), "failed");
  assert.equal(evaluationDisplay({ status: "analyzing", createdAt, hasLiveJob: true }), "analyzing");
});

test("a fresh analyzing call still reads as in progress", () => {
  assert.equal(evaluationDisplay({ status: "analyzing", createdAt: new Date().toISOString() }), "analyzing");
});

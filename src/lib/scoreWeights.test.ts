import assert from "node:assert/strict";
import type { Call } from "@/types";
import { computeCallScore } from "./callInsights";
import { methodById } from "./salesMethods";
import {
  collectMetricScores,
  mergeIncomingWeights,
  sanitizeWeights,
  weightedCallScore,
  weightsAreCustom,
  weightsForMethod,
} from "./scoreWeights";

const sandler = methodById("sandler");
const meddic = methodById("meddic");

const even = weightsForMethod({}, sandler);
assert.equal(even.pain, 1);
assert.equal(even.scriptAdherence, 1);
assert.equal(even.upFrontContract, 1);
assert.equal(weightsAreCustom(even, sandler), false);

const dirty = sanitizeWeights({ pain: 8, budget: "nope", notAMetric: 9, scriptAdherence: 12, nextStep: 0 });
assert.deepEqual(dirty, { pain: 8, scriptAdherence: 10, nextStep: 0 });
assert.equal(weightsAreCustom(weightsForMethod(dirty, sandler), sandler), true);
assert.equal(weightsAreCustom(weightsForMethod(dirty, meddic), meddic), true);

const merged = mergeIncomingWeights({ pain: 4, budget: 2 }, { pain: 1, peerAuthority: 3 });
assert.equal(merged.pain, 1);
assert.equal(merged.budget, 2);
assert.equal(merged.peerAuthority, 3);

const call: Call = {
  id: "c1",
  repId: "r1",
  repName: "Rep",
  prospectCompany: "Acme",
  prospectName: "Pat",
  callStage: "Discovery",
  coreOutcome: "Dropped",
  durationSeconds: 60,
  transcriptText: "Rep: hello\nPat: hi",
  status: "completed",
  createdAt: "2026-01-01T00:00:00.000Z",
  evaluation: {
    id: "e1",
    callId: "c1",
    repId: "r1",
    repName: "Rep",
    callTypeDetected: "Discovery",
    coreOutcome: "Dropped",
    bottomLine: "",
    missedOpportunities: [],
    sandlerBreakdown: {
      pain: { status: "Pass", evidence: "Named the loss." },
      budget: { status: "Fail", evidence: "Skipped." },
      decision: { status: "Fail", evidence: "Skipped." },
      scriptAdherence: { score: 2, feedback: "Left the script." },
    },
    topFixes: [
      { title: "Ask budget", description: "Ask it." },
      { title: "Map the buyer", description: "Name them." },
    ],
    scorecard: [
      { key: "pain", label: "Pain", status: "Pass", score: 10, evidence: "Named the loss." },
      { key: "budget", label: "Budget", status: "Fail", score: 0, evidence: "Skipped." },
      { key: "decision", label: "Decision", status: "Fail", score: 0, evidence: "Skipped." },
      { key: "fightForTheWin", label: "Fight for the Win", status: "Fail", score: 2, evidence: "Folded." },
      { key: "nextStep", label: "Next-step firmness", status: "Fail", score: 2, evidence: "No date." },
      { key: "discoveryDepth", label: "Discovery depth", status: "Incomplete", score: 4, evidence: "Thin." },
      { key: "controlAndPacing", label: "Control & pacing", status: "Fail", score: 2, evidence: "They drove." },
      { key: "peerAuthority", label: "Peer authority", status: "Fail", score: 2, evidence: "Vendor tone." },
    ],
    createdAt: "2026-01-01T00:00:00.000Z",
  },
};

const legacy = computeCallScore(call);
assert.equal(computeCallScore(call, { weights: even, method: sandler }), legacy);

const painHeavy = weightsForMethod({ pain: 10, budget: 0, decision: 0, scriptAdherence: 0, fightForTheWin: 0, nextStep: 0, discoveryDepth: 0, controlAndPacing: 0, peerAuthority: 0, upFrontContract: 0, reversing: 0, permissionToPivot: 0, strippingLine: 0, thermometerClose: 0 }, sandler);
const scores = collectMetricScores(call, sandler);
assert.equal(weightedCallScore(scores, painHeavy, sandler), 100);
assert.equal(computeCallScore(call, { weights: painHeavy, method: sandler }), 100);
assert.ok(computeCallScore(call, { weights: painHeavy, method: sandler }) > legacy);

console.log("score weight checks passed");

import assert from "node:assert/strict";
import { DEFAULT_SANDLER_INSTRUCTIONS } from "./sandlerCoach";
import { formatMethodologyBlock, methodologyForInstructions } from "./methodology";
import { SANDLER_DEBRIEF, debriefSections, mergeDebrief, scoreSandlerDebrief } from "./sandlerChecklist";

const labels = SANDLER_DEBRIEF.map((item) => item.label).join(" | ");
for (const phrase of [
  "Dummy curve question",
  "Didn't take think-it-over",
  "Real emotional reason (3rd-level pain)",
  "Didn't paint seagulls in the prospect's picture",
  "Monkey's paw when the larger ask isn't funded",
  "If no yes or no, a clear future on both calendars",
  "Bracketing to help them arrive at a number",
  "Stroke / pain / impact",
  "Willing and able to invest the resources",
]) {
  assert.ok(labels.includes(phrase), phrase);
}

const sections = debriefSections().map((section) => section.section);
assert.deepEqual(sections.slice(0, 3), ["Pre-Call", "Bonding & Rapport", "Opening Up-Front Contract"]);
assert.ok(sections.includes("Pain"));
assert.ok(sections.includes("Budget / Resources"));
assert.ok(sections.includes("Post-Sell"));
assert.equal(SANDLER_DEBRIEF.filter((item) => item.offTape).length, 7);

const sandlerPrompt = formatMethodologyBlock(methodologyForInstructions(DEFAULT_SANDLER_INSTRUCTIONS));
assert.match(sandlerPrompt, /dummyCurve/);
assert.match(sandlerPrompt, /3rd-level pain/);
const meddicPrompt = formatMethodologyBlock(methodologyForInstructions("Methodology / framework: MEDDIC\n\nMetrics only."));
assert.doesNotMatch(meddicPrompt, /dummyCurve/);
assert.match(meddicPrompt, /Do not score another method's checklist/);

const tape = `Rep: We have 15 minutes. You can tell me no. If it makes sense we'll book time.
Buyer: How much does it cost?
Rep: That's a fair question — why do you ask?
Buyer: We're losing $4,000 per month and my boss is on me.
Rep: Maybe this isn't the right fit. On a scale of 1 to 10, where are you? I'll send the calendar invite for Tuesday.`;
const marks = scoreSandlerDebrief(tape, "Rep");
const byId = Object.fromEntries(marks.map((mark) => [mark.id, mark.status]));
assert.equal(marks.length, SANDLER_DEBRIEF.length);
assert.equal(byId.timePurpose, "Handled");
assert.equal(byId.noMeans, "Handled");
assert.equal(byId.reverseIntent, "Handled");
assert.equal(byId.softeningReverse, "Handled");
assert.equal(byId.thirdLevelPain, "Handled");
assert.equal(byId.quantifyPain, "Handled");
assert.equal(byId.thermometerEachPain, "Handled");
assert.equal(byId.negativeReverse, "Handled");
assert.equal(byId.clearFuture, "Gap");
assert.equal(byId.linkedinResearch, "Gap");

const tio = scoreSandlerDebrief("Buyer: Just send me an email and let me think about it.\nRep: Sure, I'll send that.", "Rep");
assert.equal(Object.fromEntries(tio.map((mark) => [mark.id, mark.status])).noTio, "Gap");
assert.equal(Object.fromEntries(tio.map((mark) => [mark.id, mark.status])).clearFuture, "Gap");
assert.equal(Object.fromEntries(tio.map((mark) => [mark.id, mark.status])).noBlindAction, "Gap");

const merged = mergeDebrief(
  [{ id: "timePurpose", status: "Gap", evidence: "They never set a time." }],
  tape,
  "Rep"
);
assert.equal(merged.find((mark) => mark.id === "timePurpose")?.status, "Gap");
assert.equal(merged.find((mark) => mark.id === "timePurpose")?.evidence, "They never set a time.");
assert.equal(merged.length, SANDLER_DEBRIEF.length);

console.log("sandler checklist checks passed");

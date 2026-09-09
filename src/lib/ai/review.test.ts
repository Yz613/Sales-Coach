import assert from "node:assert/strict";
import {
  buildScorecardFromSandler,
  buildWalkthroughFromTranscript,
  stampMissedOpportunities,
} from "./review";

const transcript = `David: Hi Dr. Thorne, my name is David Kim with LabSync. How are you today?
Dr. Thorne: I'm busy. What is this regarding?
David: I was calling to introduce our state of the art lab automation software that helps biotech labs increase throughput by 40%.
Dr. Thorne: We already have a LIMS system and we don't need anything new right now.
David: Oh okay, no problem! What system are you currently using if you don't mind me asking?
Dr. Thorne: Benchling. Just send me an email with some brochures and I'll keep it on file.
David: Absolutely Dr. Thorne, I'll send that right over to your inbox. Have a great day!
Dr. Thorne: Thanks, bye.`;

const missed = stampMissedOpportunities(
  [
    {
      prospectOpening: "Benchling. Just send me an email with some brochures and I'll keep it on file.",
      repSurrender: "Absolutely Dr. Thorne, I'll send that right over to your inbox. Have a great day!",
      whatToSayInstead: "I'll email you, but can we take 3 minutes Thursday?",
    },
  ],
  transcript,
  110
);

assert.ok(missed[0].timestamp);
assert.ok((missed[0].timestampSeconds || 0) > 0);
assert.ok((missed[0].repQuote || "").includes("I'll send that right over"));

const walkthrough = buildWalkthroughFromTranscript(transcript, 110, missed, "David Kim");
assert.ok(walkthrough.length >= 3);
assert.ok(walkthrough.some((s) => s.verdict === "fatal" || s.verdict === "miss"));
assert.ok(walkthrough.some((s) => s.shouldHaveDone.length > 0));
assert.ok(walkthrough.every((s) => s.timestamp.length > 0));
assert.equal(walkthrough[0].step, 1);

const scorecard = buildScorecardFromSandler({
  pain: { status: "Fail", evidence: "Pitched features" },
  budget: { status: "Fail", evidence: "Never asked" },
  decision: { status: "Fail", evidence: "Never asked" },
  scriptScore: 3,
  missedCount: 2,
  coreOutcome: "Dropped",
  foldedEarly: true,
});
assert.equal(scorecard.length, 8);
assert.equal(scorecard.find((m) => m.key === "fightForTheWin")?.status, "Fail");

console.log("review checks passed");

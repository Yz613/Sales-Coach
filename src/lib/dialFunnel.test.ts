import assert from "node:assert/strict";
import {
  dialFactsFromOutcomes,
  formatRate,
  funnelStepsFromCounts,
  resolveDialOutcome,
  tallyDialFunnel,
  type DialOutcome,
} from "./dialFunnel";

function repeat(outcome: DialOutcome, count: number): DialOutcome[] {
  return Array.from({ length: count }, () => outcome);
}

const sparse = tallyDialFunnel(dialFactsFromOutcomes([
  ...repeat("no_answer", 70),
  ...repeat("voicemail", 10),
  ...repeat("connected_not_interested", 10),
  ...repeat("connected_interested", 5),
  ...repeat("closed_won", 5),
]));
assert.equal(sparse.dials, 100);
assert.equal(sparse.connects, 20);
assert.equal(sparse.conversations, 10);
assert.equal(sparse.meetings, 5);
assert.equal(sparse.closes, 5);
assert.equal(sparse.connectRate, 20);
assert.equal(sparse.closeRate, 5);
assert.equal(sparse.closePerConnect, 25);
assert.equal(formatRate(sparse.connectRate), "20%");
assert.equal(formatRate(sparse.closeRate), "5%");
assert.equal(formatRate(sparse.closePerConnect), "25%");

const tight = tallyDialFunnel(dialFactsFromOutcomes([
  ...repeat("connected_not_interested", 10),
  ...repeat("connected_interested", 5),
  ...repeat("closed_won", 5),
]));
assert.equal(tight.dials, 20);
assert.equal(tight.connects, 20);
assert.equal(tight.closes, 5);
assert.equal(tight.connectRate, 100);
assert.equal(tight.closeRate, 25);
assert.equal(tight.closePerConnect, 25);

assert.notEqual(sparse.connectRate, tight.connectRate, "100 dials / 20 connects is not the same connect rate as 20 dials / 20 connects");
assert.notEqual(sparse.closeRate, tight.closeRate, "5 closes / 100 dials is not the same close rate as 5 closes / 20 dials");
assert.equal(sparse.closePerConnect, tight.closePerConnect);
assert.deepEqual(
  [sparse.connectRate, sparse.closeRate, sparse.closePerConnect],
  [20, 5, 25],
);
assert.deepEqual(
  [tight.connectRate, tight.closeRate, tight.closePerConnect],
  [100, 25, 25],
);

assert.ok(sparse.steps.every((step, index) => index === 0 || step.count <= sparse.steps[index - 1].count));
assert.equal(sparse.steps[0].label, "Dials");
assert.equal(sparse.steps[4].label, "Closes");
assert.equal(sparse.steps[4].rateFromStart, 5);
assert.equal(sparse.steps[1].rateFromPrevious, 20);

const lost = tallyDialFunnel(dialFactsFromOutcomes(["closed_lost", "closed_won", "meeting_booked", "voicemail"]));
assert.equal(lost.dials, 4);
assert.equal(lost.connects, 3);
assert.equal(lost.conversations, 3);
assert.equal(lost.meetings, 3);
assert.equal(lost.closes, 1, "closed lost is not a close");
assert.equal(lost.closeRate, 25);
assert.equal(Math.round(lost.closePerConnect * 10) / 10, 33.3);

assert.equal(resolveDialOutcome({ coreOutcome: "Meeting booked", hasConversation: true }), "meeting_booked");
assert.equal(resolveDialOutcome({ coreOutcome: "Dropped", hasConversation: true }), "connected_not_interested");
assert.equal(resolveDialOutcome({ coreOutcome: "Dropped", hasConversation: false }), "no_answer");
assert.equal(resolveDialOutcome({ coreOutcome: "Demo agreed", hasConversation: true }), "connected_interested");
assert.equal(resolveDialOutcome({ coreOutcome: "Analyzing...", hasConversation: false }), "no_answer");
assert.equal(resolveDialOutcome({ coreOutcome: "Analyzing...", hasConversation: true }), "connected_not_interested");
assert.equal(resolveDialOutcome({ dialOutcome: "voicemail", coreOutcome: "Meeting booked" }), "voicemail");
assert.equal(resolveDialOutcome({ coreOutcome: "No answer / missed" }), "no_answer");
assert.equal(resolveDialOutcome({ coreOutcome: "Closed won" }), "closed_won");

const ignoredMisses = tallyDialFunnel(dialFactsFromOutcomes([...repeat("connected_interested", 15), ...repeat("closed_won", 5)]));
const withMisses = tallyDialFunnel(dialFactsFromOutcomes([
  ...repeat("no_answer", 80),
  ...repeat("connected_interested", 15),
  ...repeat("closed_won", 5),
]));
assert.equal(ignoredMisses.closeRate, 25);
assert.equal(withMisses.closeRate, 5);
assert.equal(withMisses.connectRate, 20);
assert.ok(withMisses.closeRate < ignoredMisses.closeRate);

const steps = funnelStepsFromCounts({ dials: 100, connects: 20, conversations: 10, meetings: 5, closes: 5 });
assert.equal(steps[4].rateFromPrevious, 100);
assert.equal(steps[1].rateFromStart, 20);

console.log("dial funnel checks passed");

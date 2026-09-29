import assert from "node:assert/strict";
import { DEFAULT_SANDLER_INSTRUCTIONS } from "./sandlerCoach";
import { cookbookStageReached, tallyCookbookFunnel } from "./cookbookFunnel";
import {
  SANDLER_METHODOLOGY,
  deriveCoachingBrief,
  methodologyForInstructions,
  scoreMicroSkills,
  scoreSandlerBudget,
  scoreSandlerPain,
} from "./methodology";

assert.equal(methodologyForInstructions("").id, "sandler");
assert.equal(methodologyForInstructions(DEFAULT_SANDLER_INSTRUCTIONS).id, "sandler");
assert.deepEqual(
  SANDLER_METHODOLOGY.pillars.map((pillar) => pillar.key),
  ["pain", "budget", "decision"]
);

const meddic = methodologyForInstructions("Methodology / framework: MEDDIC\n\nWe score metrics, not Sandler pain.");
assert.equal(meddic.id, "custom");
assert.equal(meddic.name, "MEDDIC");
assert.equal(meddic.microSkills.length, 0);
assert.equal(methodologyForInstructions("Methodology / framework: Sandler, tweaked for our floor").id, "sandler");

const candy = `Rep: Let me show you the platform and how the feature works.
Buyer: We lose about $4,000 a month in shrinkage and my boss is on me about it.`;
const candyScore = scoreSandlerPain(candy, "Rep");
assert.equal(candyScore.status, "Fail");
assert.match(candyScore.evidence, /Spilling candy/);

const fullPain = `Rep: What's this costing the company, and what's it doing to you?
Buyer: We're losing two hours a day on that lane. Personally I'm the one who gets blamed.`;
assert.equal(scoreSandlerPain(fullPain, "Rep").status, "Pass");

const halfPain = `Buyer: The downtime is costing us a shift a week.`;
assert.equal(scoreSandlerPain(halfPain, "Rep").status, "Incomplete");

assert.equal(scoreSandlerBudget("Rep: What is your budget?").status, "Incomplete");
assert.match(scoreSandlerBudget("Rep: What is your budget?").evidence, /not a pass/);
assert.equal(
  scoreSandlerBudget("Rep: Who else has to sign off, and how long is the rollout if this is costing you $4,000 per month?").status,
  "Pass"
);
assert.equal(scoreSandlerBudget("Rep: Thanks for your time.").status, "Fail");

const skills = scoreMicroSkills(
  `Rep: We have 15 minutes. The agenda is to see if this is worth a next step. You can tell me no.
Buyer: How much does it cost?
Rep: Why do you ask?
Buyer: Maybe later.
Rep: Maybe this isn't the right fit right now. Can I make a suggestion? On a scale of 1 to 10, where are you?`,
  SANDLER_METHODOLOGY.microSkills,
  "Rep"
);
const byKey = Object.fromEntries(skills.map((skill) => [skill.key, skill.status]));
assert.equal(byKey.upFrontContract, "Pass");
assert.equal(byKey.reversing, "Pass");
assert.equal(byKey.permissionToPivot, "Pass");
assert.equal(byKey.strippingLine, "Pass");
assert.equal(byKey.thermometerClose, "Pass");
assert.equal(scoreMicroSkills("Buyer: How much is it?\nRep: It's $500 a month.", SANDLER_METHODOLOGY.microSkills, "Rep").find((skill) => skill.key === "reversing")?.status, "Fail");

const brief = deriveCoachingBrief({
  wins: ["Reversed the price question."],
  gaps: ["Pitched before pain."],
  drills: ["Ask why they asked."],
});
assert.match(brief.praiseReinforcement, /Reversed/);
assert.ok(brief.praiseReinforcement.length > 0);

assert.equal(cookbookStageReached({ callStage: "Cold Call", coreOutcome: "Dropped", durationSeconds: 20 }), 0);
assert.equal(cookbookStageReached({ callStage: "Cold Call", coreOutcome: "Dropped", durationSeconds: 120 }), 1);
assert.equal(cookbookStageReached({ callStage: "First Discovery", coreOutcome: "Dropped", durationSeconds: 30 }), 2);
assert.equal(cookbookStageReached({ callStage: "Cold Call", coreOutcome: "Meeting booked", durationSeconds: 40 }), 3);

const funnel = tallyCookbookFunnel([
  { callStage: "Cold Call", coreOutcome: "Dropped", durationSeconds: 20 },
  { callStage: "Cold Call", coreOutcome: "Dropped", durationSeconds: 120 },
  { callStage: "First Discovery", coreOutcome: "Negotiation Pending", durationSeconds: 400, painQualified: true },
  { callStage: "Demo", coreOutcome: "Demo agreed", durationSeconds: 900 },
]);
assert.deepEqual(funnel.map((step) => step.count), [4, 3, 2, 1]);
assert.deepEqual(funnel.map((step) => step.label), ["Dials", "Meaningful Convos", "Discoveries", "Proposals / Demos"]);

console.log("methodology checks passed");

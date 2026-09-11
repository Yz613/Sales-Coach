import assert from "node:assert/strict";
import { DEFAULT_CALL_STAGES, mergeCallStages, normalizeStageName, stagesEqual } from "./callStages";
import { DEFAULT_SANDLER_INSTRUCTIONS, isDefaultSandlerInstructions } from "./sandlerCoach";

assert.deepEqual(
  mergeCallStages(null, [], []),
  [...DEFAULT_CALL_STAGES],
  "empty input uses built-in stages"
);

assert.deepEqual(
  mergeCallStages(null, ["Demo"], ["Renewal"]),
  [...DEFAULT_CALL_STAGES, "Demo", "Renewal"],
  "discovers extra types from scripts and calls"
);

assert.deepEqual(
  mergeCallStages(["Cold Call", "Demo"], ["demo", "Follow-up"], ["Ghost"]),
  ["Cold Call", "Demo", "Follow-up", "Ghost"],
  "dedupes case-insensitively and preserves stored order"
);

assert.equal(normalizeStageName("  Executive   Briefing  "), "Executive Briefing");
assert.equal(stagesEqual("cold call", "Cold Call"), true);
assert.equal(stagesEqual("Demo", "Renewal"), false);

assert.equal(isDefaultSandlerInstructions(""), true);
assert.equal(isDefaultSandlerInstructions(DEFAULT_SANDLER_INSTRUCTIONS), true);
assert.equal(isDefaultSandlerInstructions("We run MEDDIC only."), false);
assert.ok(DEFAULT_SANDLER_INSTRUCTIONS.includes("Sandler Selling System"));
assert.ok(DEFAULT_SANDLER_INSTRUCTIONS.includes("Up-Front Contract"));
assert.ok(DEFAULT_SANDLER_INSTRUCTIONS.includes("Demo agreed"));

console.log("callStages + sandlerCoach checks passed");

import assert from "node:assert/strict";
import { extractJson, repairLlmJson } from "./json";

assert.deepEqual(extractJson('{"ok":true}'), { ok: true });

assert.deepEqual(
  extractJson('Here you go\n```json\n{"ok": true}\n```\n'),
  { ok: true }
);

const missingComma = `{
  "quote": "Just send me an email"
  "whatHappened": "Rep folded"
}`;
assert.match(
  (() => {
    try {
      JSON.parse(missingComma);
      return "no error";
    } catch (err) {
      return err instanceof Error ? err.message : String(err);
    }
  })(),
  /Expected ',' or '}' after property value/
);
assert.deepEqual(extractJson(missingComma), {
  quote: "Just send me an email",
  whatHappened: "Rep folded",
});

const innerQuotes = `{
  "quote": "He said "we're all set" and hung up",
  "score": 2
}`;
assert.deepEqual(extractJson(innerQuotes), {
  quote: `He said "we're all set" and hung up`,
  score: 2,
});

assert.deepEqual(extractJson('{"a":1,}'), { a: 1 });
assert.deepEqual(extractJson('{"note": "line1\nline2"}'), { note: "line1\nline2" });

const lines = ["{"];
for (let i = 0; i < 236; i++) {
  lines.push(`  "k${i}": "value ${i}",`);
}
lines.push(`  "quote": "I'll send that over"`);
lines.push(`  "whatHappened": "Rep treated the brush-off as a dismissal"`);
lines.push("}");
const longMissingComma = lines.join("\n");
let parseError = "";
try {
  JSON.parse(longMissingComma);
} catch (err) {
  parseError = err instanceof Error ? err.message : String(err);
}
assert.match(parseError, /Expected ',' or '}' after property value in JSON at position \d+/);
const parsedLong = extractJson(longMissingComma);
assert.equal(parsedLong.k0, "value 0");
assert.equal(parsedLong.quote, "I'll send that over");
assert.equal(parsedLong.whatHappened, "Rep treated the brush-off as a dismissal");

const walkthrough = `{
  "walkthrough": [
    {
      "step": 1,
      "quote": "How are you today?",
      "whatHappened": "Opened like a vendor"
      "shouldHaveDone": "Lead with a 30-second permission interrupt"
    }
  ]
}`;
assert.equal(extractJson(walkthrough).walkthrough[0].shouldHaveDone.includes("permission"), true);

const repaired = repairLlmJson(missingComma);
assert.deepEqual(JSON.parse(repaired), {
  quote: "Just send me an email",
  whatHappened: "Rep folded",
});

console.log("json extract checks passed");

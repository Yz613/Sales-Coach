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
assert.deepEqual(extractJson('{"a":[1,]}'), { a: [1] });
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

assert.deepEqual(extractJson('{"evidence": "[1:12] "send me an email" — folded", "score": 2}'), {
  evidence: '[1:12] "send me an email" — folded',
  score: 2,
});

assert.deepEqual(extractJson('{"quote": "He said "wait", then left", "score": 2}'), {
  quote: 'He said "wait", then left',
  score: 2,
});

assert.deepEqual(extractJson('{"note": "Call it "pain": the real gap", "score": 1}'), {
  note: 'Call it "pain": the real gap',
  score: 1,
});

assert.deepEqual(
  extractJson(`{
  "whatHappened": "Rep said "sure thing.""
  "shouldHaveDone": "Fight"
}`),
  {
    whatHappened: 'Rep said "sure thing."',
    shouldHaveDone: "Fight",
  }
);

assert.deepEqual(extractJson('{"quote": "Just send me an email" "whatHappened": "Rep folded"}'), {
  quote: "Just send me an email",
  whatHappened: "Rep folded",
});

assert.deepEqual(extractJson('{\n  "a": 1\n  // coach note\n  "b": 2\n}'), { a: 1, b: 2 });
assert.deepEqual(extractJson('{"score": 8/10}'), { score: 8 });
assert.deepEqual(extractJson('{\n  "a": 1,\n  b: 2\n}'), { a: 1, b: 2 });
assert.deepEqual(extractJson("{'a': 'foo', 'b': 1}"), { a: "foo", b: 1 });
assert.deepEqual(extractJson('{"ok": True, "n": None}'), { ok: true, n: null });
assert.deepEqual(extractJson(`{"a": "it\\'s fine"}`), { a: "it's fine" });
assert.deepEqual(extractJson('{"a": "hello'), { a: "hello" });
assert.deepEqual(extractJson('{"a": 1, "b":'), { a: 1, b: null });
assert.deepEqual(extractJson("{\"a\": 1\n\u200B  \"b\": 2}"), { a: 1, b: 2 });

const desyncedLines = ["{"];
for (let i = 0; i < 140; i++) desyncedLines.push(`  "k${i}": "value ${i}",`);
desyncedLines.push(`  "note": "Call it "pain": the real gap",`);
for (let i = 140; i < 290; i++) desyncedLines.push(`  "k${i}": "value ${i}",`);
desyncedLines.push(`  "quote": "I will send the email"`);
desyncedLines.push(`  "whatHappened": "folded"`);
desyncedLines.push("}");
const longDesynced = desyncedLines.join("\n");
let longError = "";
try {
  JSON.parse(longDesynced);
} catch (err) {
  longError = err instanceof Error ? err.message : String(err);
}
assert.match(longError, /Expected ',' or '}' after property value in JSON at position \d+ \(line \d+ column \d+\)/);
const parsedDesynced = extractJson(longDesynced);
assert.equal(parsedDesynced.k0, "value 0");
assert.equal(parsedDesynced.note, 'Call it "pain": the real gap');
assert.equal(parsedDesynced.quote, "I will send the email");
assert.equal(parsedDesynced.whatHappened, "folded");

console.log("json extract checks passed");

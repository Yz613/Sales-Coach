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

const hyphenQuote = `{
  "evidence": "[1:12] "I'll send that over." - rep folded",
  "score": 2
}`;
assert.equal(
  extractJson(hyphenQuote).evidence,
  `[1:12] "I'll send that over." - rep folded`
);

const commaInSentence = `{
  "quote": "He said "send the email", then left",
  "whatHappened": "Rep folded"
}`;
assert.equal(extractJson(commaInSentence).quote, `He said "send the email", then left`);

const trueProse = `{
  "quote": "He said "true, we are set" and left",
  "score": 1
}`;
assert.equal(extractJson(trueProse).quote, `He said "true, we are set" and left`);

const nbsp = `{\n  "a": "hello"\u00a0\n  "b": 1\n}`;
assert.deepEqual(extractJson(nbsp), { a: "hello", b: 1 });

const reviewLines = ["{"];
reviewLines.push(`  "bottomLine": "summary",`);
reviewLines.push(`  "scorecard": [`);
for (let i = 0; i < 8; i++) {
  reviewLines.push(`    {"key": "k${i}", "score": ${i}, "evidence": "fine ${i}"},`);
}
reviewLines[reviewLines.length - 1] = reviewLines[reviewLines.length - 1].replace(/,$/, "");
reviewLines.push(`  ],`);
reviewLines.push(`  "walkthrough": [`);
for (let i = 0; i < 18; i++) {
  reviewLines.push(`    {`);
  reviewLines.push(`      "step": ${i + 1},`);
  reviewLines.push(`      "quote": "line ${i}",`);
  reviewLines.push(`      "whatHappened": "note ${i}"`);
  reviewLines.push(i === 17 ? `    }` : `    },`);
}
reviewLines.push(`  ]`);
reviewLines.push(`  "scriptDivergence": {"scriptTitle": "S"}`);
reviewLines.push(`}`);
const column3 = reviewLines.join("\n");
let column3Error = "";
try {
  JSON.parse(column3);
} catch (err) {
  column3Error = err instanceof Error ? err.message : String(err);
}
assert.match(column3Error, /Expected ',' or '}' after property value in JSON at position (\d+)/);
const column3Pos = Number(column3Error.match(/at position (\d+)/)?.[1]);
const column3LineStart = column3.lastIndexOf("\n", column3Pos - 1) + 1;
assert.equal(column3Pos - column3LineStart + 1, 3);
const column3Parsed = extractJson(column3);
assert.equal(column3Parsed.bottomLine, "summary");
assert.equal(column3Parsed.walkthrough.length, 18);
assert.equal(column3Parsed.scriptDivergence.scriptTitle, "S");

const hyphenThenMissingComma = column3.replace(
  `"evidence": "fine 3"`,
  `"evidence": "[1:12] "send the pdf." - folded"`
);
const hyphenParsed = extractJson(hyphenThenMissingComma);
assert.equal(hyphenParsed.scorecard[3].evidence, `[1:12] "send the pdf." - folded`);
assert.equal(hyphenParsed.scriptDivergence.scriptTitle, "S");

console.log("json extract checks passed");

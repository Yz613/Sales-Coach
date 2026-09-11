import assert from "node:assert/strict";
import { completeJson } from "./llm";

const originalFetch = globalThis.fetch;

const malformed = `{
  "coreOutcome": "Dropped",
  "bottomLine": "Folded at 1:12 after "send me an email".",
  "walkthrough": [
    {
      "step": 1,
      "quote": "Just send me an email"
      "whatHappened": "Prospect offered a brush-off"
    }
  ]
}`;

assert.match(
  (() => {
    try {
      JSON.parse(malformed);
      return "no error";
    } catch (err) {
      return err instanceof Error ? err.message : String(err);
    }
  })(),
  /Expected ',' or '}' after property value/
);

globalThis.fetch = (async (input: any, init?: any) => {
  const url = String(input);
  const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
  assert.match(url, /models\/gemini-3\.8-flash:generateContent/);
  assert.equal(body.generationConfig.responseMimeType, "application/json");
  assert.equal(body.generationConfig.maxOutputTokens, 16384);
  assert.deepEqual(body.generationConfig.thinkingConfig, { thinkingLevel: "low" });
  return new Response(
    JSON.stringify({
      candidates: [{
        finishReason: "STOP",
        content: { parts: [{ text: malformed }] },
      }],
      usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50 },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}) as typeof fetch;

async function run(): Promise<void> {
  try {
    const result = await completeJson({
      providerId: "gemini",
      apiKey: "AIza-test",
      model: "gemini-3.8-flash",
      prompt: "score this call",
    });
    assert.equal(result.parsed.coreOutcome, "Dropped");
    assert.match(result.parsed.bottomLine, /send me an email/);
    assert.equal(result.parsed.walkthrough[0].whatHappened, "Prospect offered a brush-off");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

run()
  .then(() => console.log("llm json recovery checks passed"))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

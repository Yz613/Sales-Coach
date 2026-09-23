import assert from "node:assert/strict";
import { EVALUATION_RESPONSE_SCHEMA } from "./evaluationSchema";
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
  assert.deepEqual(body.generationConfig.responseJsonSchema, EVALUATION_RESPONSE_SCHEMA);
  assert.equal(body.generationConfig.responseFormat.text.mimeType, "application/json");
  assert.deepEqual(body.generationConfig.responseFormat.text.schema, EVALUATION_RESPONSE_SCHEMA);
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
      responseSchema: EVALUATION_RESPONSE_SCHEMA,
    });
    assert.equal(result.parsed.coreOutcome, "Dropped");
    assert.match(result.parsed.bottomLine, /send me an email/);
    assert.equal(result.parsed.walkthrough[0].whatHappened, "Prospect offered a brush-off");

    const modes: string[] = [];
    globalThis.fetch = (async (_input: any, init?: any) => {
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
      const config = body.generationConfig || {};
      const mode = config.responseFormat ? "format" : config.responseJsonSchema ? "jsonSchema" : "mime";
      modes.push(mode);
      if (config.responseFormat) {
        return new Response(
          JSON.stringify({ error: { message: 'Invalid JSON payload received. Unknown name "responseFormat"' } }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({
          candidates: [{
            finishReason: "STOP",
            content: { parts: [{ text: '{"a":1\n  "b":2}' }] },
          }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;

    const retried = await completeJson({
      providerId: "gemini",
      apiKey: "AIza-test",
      model: "gemini-3.8-flash",
      prompt: "score this call",
      responseSchema: { type: "object" },
    });
    assert.deepEqual(retried.parsed, { a: 1, b: 2 });
    assert.deepEqual(modes, ["format", "jsonSchema"]);
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

import assert from "node:assert/strict";
import { EVALUATION_RESPONSE_SCHEMA } from "./evaluationSchema";
import { completeJson } from "./llm";

const originalFetch = globalThis.fetch;

const malformed = `{
  "callTypeDetected": "Cold Call",
  "sandlerBreakdown": {"pain":{"status":"Fail","evidence":"none"},"budget":{"status":"Fail","evidence":"none"},"decision":{"status":"Fail","evidence":"none"},"scriptAdherence":{"score":0,"feedback":"none"}},
  "missedOpportunities": [], "scorecard": [], "scriptDivergence": {"scriptTitle":"Default","milestones":[]},
  "topFixes": [], "coachingBrief":{"praiseReinforcement":"none","tacticalGaps":"none","remedialDrills":"none"},
  "coreOutcome": "Dropped",
  "bottomLine": "Folded at 1:12 after "send me an email".",
  "walkthrough": [
    {
      "step": 1, "timestamp": "1:12", "speaker": "Prospect", "shouldHaveDone": "Ask why", "verdict": "coach", "category": "Objection",
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
  assert.equal(body.store, false);
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

    const captured: { url: string; body: any }[] = [];
    globalThis.fetch = (async (input: any, init?: any) => {
      const url = String(input);
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
      captured.push({ url, body });
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"ok":true}' } }],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;

    await completeJson({
      providerId: "openrouter",
      apiKey: "sk-or-test",
      model: "openai/gpt-4o-mini",
      prompt: "score this call",
    });
    await completeJson({
      providerId: "openai",
      apiKey: "sk-test",
      model: "gpt-4o-mini",
      prompt: "score this call",
    });
    await completeJson({
      providerId: "groq",
      apiKey: "gsk-test",
      model: "llama-3.3-70b-versatile",
      prompt: "score this call",
    });

    const openrouter = captured.find((call) => call.url.includes("openrouter.ai"));
    assert.ok(openrouter, "OpenRouter request should be sent");
    assert.equal(openrouter.url, "https://openrouter.ai/api/v1/chat/completions");
    assert.deepEqual(openrouter.body.provider, { data_collection: "deny" });
    assert.equal(openrouter.body.store, undefined);

    const openai = captured.find((call) => call.url.includes("api.openai.com"));
    assert.ok(openai, "OpenAI request should be sent");
    assert.equal(openai.body.store, false);

    const groq = captured.find((call) => call.url.includes("api.groq.com"));
    assert.ok(groq, "Groq request should be sent");
    assert.equal(groq.body.store, false);
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

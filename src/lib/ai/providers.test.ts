import assert from "node:assert/strict";
import {
  detectProviderFromKey,
  estimateCostUsd,
  formatUsd,
  getProvider,
  defaultModelForProvider,
  DEFAULT_MODEL,
} from "./providers";
import {
  geminiGenerationConfig,
  geminiModelsToTry,
  geminiTextFromResponse,
  isGemini3Model,
} from "./gemini";

assert.equal(detectProviderFromKey("sk-ant-abc"), "anthropic");
assert.equal(detectProviderFromKey("gsk_abc"), "groq");
assert.equal(detectProviderFromKey("sk-or-v1-abc"), "openrouter");
assert.equal(detectProviderFromKey("AIzaSyXXXX"), "gemini");
assert.equal(detectProviderFromKey("sk-proj-openai"), "openai");
assert.equal(detectProviderFromKey(""), null);

assert.equal(getProvider("openai").name, "OpenAI");
assert.equal(defaultModelForProvider("anthropic"), "claude-haiku-4-5");

const cost = estimateCostUsd({ inputPerMTok: 1, outputPerMTok: 2 }, 1_000_000, 1_000_000);
assert.equal(cost, 3);
assert.equal(formatUsd(0.15), "$0.15");
assert.equal(formatUsd(3), "$3.00");
assert.equal(formatUsd(0.002), "$0.0020");

assert.equal(isGemini3Model("gemini-3.8-flash"), true);
assert.equal(isGemini3Model("gemini-3.7-flash"), true);
assert.equal(isGemini3Model("google/gemini-3.8-flash"), true);
assert.equal(isGemini3Model("gemini-2.5-flash"), false);
assert.equal(DEFAULT_MODEL, "gemini-3.8-flash");
assert.deepEqual(geminiModelsToTry("gemini-3.8-flash"), ["gemini-3.8-flash"]);
assert.deepEqual(geminiModelsToTry("gemini-2.5-pro"), ["gemini-2.5-pro"]);
assert.deepEqual(geminiModelsToTry(""), [DEFAULT_MODEL]);
assert.deepEqual(geminiModelsToTry(undefined), [DEFAULT_MODEL]);

const flash38 = geminiGenerationConfig("gemini-3.8-flash", {
  thinkingLevel: "low",
  temperature: 0.1,
  maxOutputTokens: 16384,
});
assert.deepEqual(flash38.thinkingConfig, { thinkingLevel: "low" });
assert.equal(flash38.temperature, undefined);
assert.equal(flash38.maxOutputTokens, 16384);

const flash25 = geminiGenerationConfig("gemini-2.5-flash", { temperature: 0.1 });
assert.equal(flash25.temperature, 0.1);
assert.equal(flash25.thinkingConfig, undefined);

assert.equal(
  geminiTextFromResponse({
    candidates: [{
      content: {
        parts: [
          { thought: true, text: "I will transcribe this." },
          { text: "[0:01] Rep: Hello" },
        ],
      },
    }],
  }),
  "[0:01] Rep: Hello"
);

assert.equal(
  geminiTextFromResponse({
    candidates: [{
      content: {
        parts: [
          { text: '{"quote": "hel' },
          { text: 'lo"}' },
        ],
      },
    }],
  }),
  '{"quote": "hello"}'
);

const schema = { type: "object", properties: { ok: { type: "boolean" } } };
const withSchema = geminiGenerationConfig("gemini-3.8-flash", {
  responseMimeType: "application/json",
  responseSchema: schema,
  maxOutputTokens: 16384,
});
assert.equal(withSchema.responseJsonSchema, schema);
assert.deepEqual(withSchema.responseFormat, {
  text: { mimeType: "application/json", schema },
});
const mimeOnly = geminiGenerationConfig("gemini-2.5-flash", {
  responseMimeType: "application/json",
  responseSchema: schema,
  schemaMode: "mimeOnly",
  temperature: 0.2,
});
assert.equal(mimeOnly.responseJsonSchema, undefined);
assert.equal(mimeOnly.responseFormat, undefined);
assert.equal(mimeOnly.temperature, 0.2);

console.log("providers checks passed");

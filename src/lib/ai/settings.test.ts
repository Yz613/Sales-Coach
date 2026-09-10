import assert from "node:assert/strict";
import { modelForProvider, providerForKey, resolveAiSettingsFrom } from "./settings";

const emptyEnv: Record<string, string | undefined> = {
  GEMINI_API_KEY: "",
  OPENAI_API_KEY: "",
  ANTHROPIC_API_KEY: "",
  GROQ_API_KEY: "",
  OPENROUTER_API_KEY: "",
};

assert.equal(providerForKey("AIzaSyTESTKEY", "openai").providerId, "gemini");
assert.equal(providerForKey("AIzaSyTESTKEY", "openai").corrected, true);
assert.equal(providerForKey("sk-proj-openai", "openai").providerId, "openai");
assert.equal(providerForKey("sk-proj-openai", "openai").corrected, false);
assert.equal(providerForKey("gsk_abc", "gemini").providerId, "groq");
assert.equal(modelForProvider("gemini", "gpt-4o-mini"), "gemini-3.8-flash");
assert.equal(modelForProvider("openai", "gpt-4o-mini"), "gpt-4o-mini");
assert.equal(modelForProvider("openrouter", "my/custom-model"), "my/custom-model");

const mismatched = resolveAiSettingsFrom(
  {
    ai_api_key: "AIzaSyCONNECTEDKEY1234",
    ai_provider: "openai",
    active_model: "gpt-4o-mini",
  },
  emptyEnv
);
assert.equal(mismatched.hasKey, true);
assert.equal(mismatched.providerId, "gemini");
assert.equal(mismatched.model, "gemini-3.8-flash");
assert.equal(mismatched.providerCorrected, true);
assert.equal(mismatched.apiKey, "AIzaSyCONNECTEDKEY1234");

const openai = resolveAiSettingsFrom(
  {
    ai_api_key: "sk-proj-openai-key-123456",
    ai_provider: "openai",
    active_model: "gpt-4o",
  },
  emptyEnv
);
assert.equal(openai.providerId, "openai");
assert.equal(openai.model, "gpt-4o");
assert.equal(openai.providerCorrected, false);

const envOnly = resolveAiSettingsFrom({}, { ...emptyEnv, OPENAI_API_KEY: "sk-env-openai-key" });
assert.equal(envOnly.providerId, "openai");
assert.equal(envOnly.hasKey, true);

const noKey = resolveAiSettingsFrom({}, emptyEnv);
assert.equal(noKey.hasKey, false);
assert.equal(noKey.apiKey, null);

console.log("settings checks passed");

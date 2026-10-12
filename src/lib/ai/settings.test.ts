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
assert.equal(noKey.baseUrl, null);

assert.equal(providerForKey("AIzaSyTESTKEY", "local").providerId, "local");
assert.equal(providerForKey("AIzaSyTESTKEY", "local").corrected, false);

const local = resolveAiSettingsFrom(
  {
    ai_provider: "local",
    ai_api_key: "AIzaSySHOULDNOTSWITCH",
    active_model: "llama3.1",
    local_base_url: "http://127.0.0.1:11434/v1",
    local_whisper_base_url: "http://127.0.0.1:9000/v1/",
  },
  { ...emptyEnv, ALLOW_PRIVATE_MODEL_URLS: "true" }
);
assert.equal(local.providerId, "local");
assert.equal(local.providerCorrected, false);
assert.equal(local.model, "llama3.1");
assert.equal(local.baseUrl, "http://127.0.0.1:11434/v1");
assert.equal(local.whisperBaseUrl, "http://127.0.0.1:9000/v1");
assert.equal(local.hasKey, true);
assert.equal(local.apiKey, "local");
assert.notEqual(local.apiKey, "AIzaSySHOULDNOTSWITCH");

const keptHostedKey = resolveAiSettingsFrom(
  {
    ai_provider: "local",
    ai_api_key: "sk-proj-hosted-secret-1234",
    local_api_key: "ollama-token",
    local_base_url: "https://llm.example.com/v1",
  },
  emptyEnv
);
assert.equal(keptHostedKey.providerId, "local");
assert.equal(keptHostedKey.apiKey, "ollama-token");
assert.equal(keptHostedKey.localApiKey, "ollama-token");

const hostedStillThere = resolveAiSettingsFrom(
  {
    ai_provider: "openai",
    ai_api_key: "sk-proj-hosted-secret-1234",
    local_api_key: "ollama-token",
  },
  emptyEnv
);
assert.equal(hostedStillThere.providerId, "openai");
assert.equal(hostedStillThere.apiKey, "sk-proj-hosted-secret-1234");

const blocked = resolveAiSettingsFrom(
  { ai_provider: "local", local_base_url: "http://127.0.0.1:11434/v1" },
  emptyEnv
);
assert.equal(blocked.providerId, "local");
assert.equal(blocked.baseUrl, null);
assert.equal(blocked.hasKey, false);

const fromEnv = resolveAiSettingsFrom(
  {},
  { ...emptyEnv, LOCAL_OPENAI_BASE_URL: "https://llm.example.com/v1/", LOCAL_OPENAI_MODEL: "qwen2.5" }
);
assert.equal(fromEnv.providerId, "local");
assert.equal(fromEnv.model, "qwen2.5");
assert.equal(fromEnv.baseUrl, "https://llm.example.com/v1");
assert.equal(fromEnv.apiKey, "local");
assert.equal(fromEnv.hasKey, true);

console.log("settings checks passed");

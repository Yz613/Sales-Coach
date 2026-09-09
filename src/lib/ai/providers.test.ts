import assert from "node:assert/strict";
import {
  detectProviderFromKey,
  estimateCostUsd,
  formatUsd,
  getProvider,
  defaultModelForProvider,
} from "./providers";

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

console.log("providers checks passed");

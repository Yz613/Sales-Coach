import assert from "node:assert/strict";
import {
  isPrivateOrLocalHost,
  LocalModelUrlError,
  normalizeOpenAiBaseUrl,
  openAiChatCompletionsUrl,
  openAiTranscriptionsUrl,
} from "./localEndpoint";

const locked = { allowPrivate: false };
const open = { allowPrivate: true };

assert.equal(isPrivateOrLocalHost("localhost"), true);
assert.equal(isPrivateOrLocalHost("127.0.0.1"), true);
assert.equal(isPrivateOrLocalHost("10.1.2.3"), true);
assert.equal(isPrivateOrLocalHost("192.168.1.8"), true);
assert.equal(isPrivateOrLocalHost("169.254.169.254"), true);
assert.equal(isPrivateOrLocalHost("metadata.google.internal"), true);
assert.equal(isPrivateOrLocalHost("::1"), true);
assert.equal(isPrivateOrLocalHost("api.example.com"), false);

assert.equal(
  normalizeOpenAiBaseUrl("https://llm.example.com/v1/", locked),
  "https://llm.example.com/v1"
);
assert.equal(
  openAiChatCompletionsUrl("https://llm.example.com/v1", locked),
  "https://llm.example.com/v1/chat/completions"
);
assert.equal(
  openAiChatCompletionsUrl("https://llm.example.com/v1/chat/completions", locked),
  "https://llm.example.com/v1/chat/completions"
);
assert.equal(
  openAiTranscriptionsUrl("http://127.0.0.1:9000/v1/", open),
  "http://127.0.0.1:9000/v1/audio/transcriptions"
);

assert.throws(
  () => normalizeOpenAiBaseUrl("http://127.0.0.1:11434/v1", locked),
  (err: unknown) => err instanceof LocalModelUrlError && /ALLOW_PRIVATE_MODEL_URLS/.test(err.message)
);
assert.throws(
  () => normalizeOpenAiBaseUrl("http://169.254.169.254/v1", locked),
  LocalModelUrlError
);
assert.throws(
  () => normalizeOpenAiBaseUrl("file:///etc/passwd", open),
  LocalModelUrlError
);
assert.throws(
  () => normalizeOpenAiBaseUrl("https://user:secret@llm.example.com/v1", locked),
  LocalModelUrlError
);
assert.equal(
  openAiChatCompletionsUrl("http://127.0.0.1:11434/v1", open),
  "http://127.0.0.1:11434/v1/chat/completions"
);

console.log("local endpoint checks passed");

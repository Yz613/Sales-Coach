import assert from "node:assert/strict";
import { buildWavHeader } from "../audio";
import {
  bytesToBase64,
  cleanModelTranscript,
  transcribeAudio,
  whisperSegmentsToTranscript,
  type TranscriptionBackend,
} from "./transcribe";
import { extractTranscriptFromJson, decodeTranscriptFile } from "../ingestCallFile";

assert.equal(
  whisperSegmentsToTranscript([
    { start: 4, text: "  Hello there " },
    { start: 12.4, text: "We already have a vendor." },
  ]),
  "[0:04] Hello there\n[0:12] We already have a vendor."
);

assert.equal(
  cleanModelTranscript("```text\n[0:03] Rep: Hi\n```\n"),
  "[0:03] Rep: Hi"
);
assert.ok(bytesToBase64(new Uint8Array([1, 2, 3])).length > 0);

const gongish = extractTranscriptFromJson({
  utterances: [
    { speaker: "David", start: 4, text: "Hi Dr. Thorne" },
    { speaker: "Dr. Thorne", start: 12, text: "I'm busy." },
  ],
});
assert.equal(gongish, "[0:04] David: Hi Dr. Thorne\n[0:12] Dr. Thorne: I'm busy.");

const rawJson = decodeTranscriptFile(
  new TextEncoder().encode(JSON.stringify({ transcript: "Rep: Hello\nProspect: Hi" })),
  "call.json"
);
assert.equal(rawJson, "Rep: Hello\nProspect: Hi");

const originalFetch = globalThis.fetch;
const calls: Array<{ url: string; body: any }> = [];

function makeTinyWav(): Uint8Array {
  const header = buildWavHeader(320, 8000, 1, 16);
  const out = new Uint8Array(header.length + 320);
  out.set(header, 0);
  return out;
}

globalThis.fetch = (async (input: any, init?: any) => {
  const url = String(input);
  let body: any = undefined;
  if (typeof init?.body === "string") {
    try {
      body = JSON.parse(init.body);
    } catch {
      body = init.body;
    }
  }
  calls.push({ url, body });

  if (url.includes("generativelanguage.googleapis.com") && url.includes("generateContent")) {
    const parts = body?.contents?.[0]?.parts || [];
    assert.ok(parts.some((p: any) => p.inlineData?.data), "Gemini call should include inline audio");
    assert.ok(parts.some((p: any) => /transcribe/i.test(p.text || "")), "Gemini call should ask to transcribe");
    return new Response(
      JSON.stringify({
        candidates: [{ content: { parts: [{ text: "[0:01] Rep: Thanks for taking the time.\n[0:08] Prospect: We already have a vendor." }] } }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  if (url.includes("/audio/transcriptions")) {
    return new Response(
      JSON.stringify({
        text: "Thanks for taking the time.",
        segments: [
          { start: 1, text: "Thanks for taking the time." },
          { start: 8, text: "We already have a vendor." },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  throw new Error(`Unexpected fetch: ${url}`);
}) as typeof fetch;

async function run(): Promise<void> {
  try {
    const geminiBackend: TranscriptionBackend = { kind: "gemini", apiKey: "AIza-test", model: "gemini-3.8-flash" };
    const gemini = await transcribeAudio(
      { bytes: makeTinyWav(), fileName: "demo.wav", mimeType: "audio/wav" },
      geminiBackend
    );
    assert.match(gemini.transcriptText, /Thanks for taking the time/);
    assert.match(gemini.transcriptText, /already have a vendor/);
    assert.equal(gemini.backend, "gemini");
    assert.ok(gemini.durationSeconds >= 8);
    const geminiCall = calls.find((c) => c.url.includes("generateContent"));
    assert.ok(geminiCall, "Gemini generateContent should be called");
    assert.match(geminiCall.url, /models\/gemini-3\.8-flash:generateContent/);
    assert.deepEqual(geminiCall.body?.generationConfig?.thinkingConfig, { thinkingLevel: "low" });
    assert.equal(geminiCall.body?.generationConfig?.temperature, undefined);
    assert.equal(calls.some((c) => c.url.includes("gemini-2.5")), false);

    const whisperBackend: TranscriptionBackend = { kind: "openai", apiKey: "sk-test" };
    const whisper = await transcribeAudio(
      { bytes: makeTinyWav(), fileName: "demo.wav", mimeType: "audio/wav" },
      whisperBackend
    );
    assert.equal(whisper.backend, "openai");
    assert.match(whisper.transcriptText, /\[0:01\] Thanks for taking the time/);
    assert.match(whisper.transcriptText, /\[0:08\] We already have a vendor/);

    await assert.rejects(
      () => transcribeAudio({ bytes: new Uint8Array(), fileName: "empty.mp3", mimeType: "audio/mpeg" }, geminiBackend),
      /empty/i
    );

    const fallbackCalls: string[] = [];
    globalThis.fetch = (async (input: any) => {
      const url = String(input);
      fallbackCalls.push(url);
      return new Response(
        JSON.stringify({
          error: { message: "models/gemini-3.8-flash is not found for API version v1beta" },
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;

    await assert.rejects(
      () => transcribeAudio(
        { bytes: makeTinyWav(), fileName: "legacy.wav", mimeType: "audio/wav" },
        { kind: "gemini", apiKey: "AIza-test", model: "gemini-3.8-flash" }
      ),
      /gemini-3\.8-flash/
    );
    assert.equal(fallbackCalls.some((url) => url.includes("gemini-2.5")), false);
    assert.equal(fallbackCalls.every((url) => url.includes("gemini-3.8-flash")), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

run()
  .then(() => console.log("transcribe checks passed"))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

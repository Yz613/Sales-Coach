import assert from "node:assert/strict";
import { decodeTranscriptFile, extractTranscriptFromJson, ingestCallFile } from "./ingestCallFile";

const txt = decodeTranscriptFile(
  new TextEncoder().encode("Rep: Hello there\nProspect: Send me an email"),
  "notes.txt"
);
assert.equal(txt.includes("Send me an email"), true);

const fromJson = extractTranscriptFromJson({
  segments: [
    { speaker_name: "Rep", start_time: 18, text: "Quick question before I let you go" },
  ],
});
assert.equal(fromJson, "[0:18] Rep: Quick question before I let you go");

function makeTinyMp3(): Uint8Array {
  // MPEG1 Layer III, 128kbps, 44100Hz frame so the file is detected as audio.
  const length = Math.floor((144 * 128000) / 44100);
  const frame = new Uint8Array(length);
  frame[0] = 0xff;
  frame[1] = 0xfb;
  frame[2] = 0x90;
  frame[3] = 0xc4;
  return frame;
}

async function run(): Promise<void> {
  const file = new File(["Rep: Hi\nProspect: Busy"], "paste.txt", { type: "text/plain" });
  const ingested = await ingestCallFile(file);
  assert.equal(ingested.source, "text");
  assert.match(ingested.transcriptText, /Prospect: Busy/);
  assert.equal(ingested.audioBytes, undefined);

  const mp3 = makeTinyMp3();
  const audio = new File([mp3.buffer.slice(mp3.byteOffset, mp3.byteOffset + mp3.byteLength) as ArrayBuffer], "discovery.MP3", { type: "" });
  await assert.rejects(
    () => ingestCallFile(audio),
    /Gemini, OpenAI, or Groq/i
  );
}

run()
  .then(() => console.log("ingestCallFile checks passed"))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

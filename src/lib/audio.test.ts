import assert from "node:assert/strict";
import {
  AUDIO_CHUNK_TARGET_SECONDS,
  buildWavHeader,
  canChunkAudio,
  chunkAudio,
  durationFromTranscript,
  estimateAudioDurationSeconds,
  fileExtension,
  isAudioFile,
  iterateMp3Frames,
  mergeChunkTranscripts,
  mimeTypeForAudio,
  parseMp3FrameHeader,
  parseWav,
  shiftTranscriptTimestamps,
} from "./audio";

assert.equal(fileExtension("Call Recap.MP3"), ".mp3");
assert.equal(fileExtension("notes.VTT?dl=1"), ".vtt");
assert.equal(isAudioFile({ name: "demo.MP3", type: "" }), true);
assert.equal(isAudioFile({ name: "notes.txt", type: "text/plain" }), false);
assert.equal(isAudioFile({ name: "interview.m4a", type: "application/octet-stream" }), true);
assert.equal(isAudioFile({ name: "x.bin", type: "audio/mpeg" }), true);
assert.equal(mimeTypeForAudio({ name: "a.MP3", type: "" }), "audio/mpeg");
assert.equal(canChunkAudio("audio/mpeg", "a.mp3"), true);
assert.equal(canChunkAudio("audio/mp4", "a.m4a"), false);

function makeWav(durationSeconds: number, sampleRate = 8000, channels = 1, bits = 16): Uint8Array {
  const dataSize = durationSeconds * sampleRate * channels * (bits / 8);
  const header = buildWavHeader(dataSize, sampleRate, channels, bits);
  const pcm = new Uint8Array(dataSize);
  const out = new Uint8Array(header.length + pcm.length);
  out.set(header, 0);
  out.set(pcm, header.length);
  return out;
}

const wav = makeWav(2);
const wavInfo = parseWav(wav);
assert.ok(wavInfo);
assert.equal(Math.round(wavInfo!.durationSeconds), 2);
assert.equal(Math.round(estimateAudioDurationSeconds(wav, "audio/wav", "clip.wav")), 2);

const longWav = makeWav(AUDIO_CHUNK_TARGET_SECONDS + 30);
const wavChunks = chunkAudio(longWav, "audio/wav", "long.wav");
assert.ok(wavChunks.length >= 2);
assert.equal(wavChunks[0].offsetSeconds, 0);
assert.ok(wavChunks[1].offsetSeconds > 0);
assert.equal(parseWav(wavChunks[0].bytes)?.sampleRate, 8000);

function makeMp3Frame(bitrateIndex = 9, rateIndex = 0, padding = 0): Uint8Array {
  // MPEG1 Layer III, 128kbps (index 9), 44100Hz (index 0)
  const b1 = 0b11111011; // sync + MPEG1 + Layer3 + no CRC
  const b2 = (bitrateIndex << 4) | (rateIndex << 2) | (padding << 1);
  const b3 = 0b11000100;
  const length = Math.floor((144 * 128000) / 44100) + padding;
  const frame = new Uint8Array(length);
  frame[0] = 0xff;
  frame[1] = b1;
  frame[2] = b2;
  frame[3] = b3;
  return frame;
}

const oneFrame = makeMp3Frame();
const parsed = parseMp3FrameHeader(oneFrame, 0);
assert.ok(parsed);
assert.equal(parsed!.bitrate, 128000);
assert.ok(parsed!.durationSeconds > 0);

const frameCount = 400; // ~10.4s at 1152/44100
const mp3Parts: Uint8Array[] = [];
let mp3Size = 0;
for (let i = 0; i < frameCount; i += 1) {
  const frame = makeMp3Frame();
  mp3Parts.push(frame);
  mp3Size += frame.length;
}
const mp3 = new Uint8Array(mp3Size);
let cursor = 0;
for (const part of mp3Parts) {
  mp3.set(part, cursor);
  cursor += part.length;
}
const frames = iterateMp3Frames(mp3);
assert.equal(frames.length, frameCount);
const mp3Duration = estimateAudioDurationSeconds(mp3, "audio/mpeg", "call.MP3");
assert.ok(mp3Duration > 10 && mp3Duration < 12);

const manyFrames = 4000; // ~104s, should chunk
const bigParts: Uint8Array[] = [];
let bigSize = 0;
for (let i = 0; i < manyFrames; i += 1) {
  const frame = makeMp3Frame();
  bigParts.push(frame);
  bigSize += frame.length;
}
const bigMp3 = new Uint8Array(bigSize);
cursor = 0;
for (const part of bigParts) {
  bigMp3.set(part, cursor);
  cursor += part.length;
}
const mp3Chunks = chunkAudio(bigMp3, "audio/mpeg", "long.mp3");
assert.ok(mp3Chunks.length >= 2, `expected MP3 chunking, got ${mp3Chunks.length}`);
assert.equal(mp3Chunks[0].mimeType, "audio/mpeg");
assert.ok(mp3Chunks.every((c) => iterateMp3Frames(c.bytes).length > 0));

const shifted = shiftTranscriptTimestamps("[0:04] Rep: Hello\n[0:12] Prospect: Hi", 90);
assert.match(shifted, /\[1:34\] Rep: Hello/);
assert.match(shifted, /\[1:42\] Prospect: Hi/);

const merged = mergeChunkTranscripts([
  { text: "[0:01] Rep: First clip", offsetSeconds: 0 },
  { text: "[0:02] Prospect: Second clip", offsetSeconds: 90 },
]);
assert.match(merged, /\[0:01\] Rep: First clip/);
assert.match(merged, /\[1:32\] Prospect: Second clip/);

assert.equal(durationFromTranscript("[1:12] Rep: folded\n[2:05] Prospect: bye"), 125);

console.log("audio checks passed");

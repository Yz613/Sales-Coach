import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mediaPath } from "./utils";
import { callAudioApiPath, readCallAudio, saveCallAudio } from "./callAudioStore";
import { parseTranscript } from "./transcript";

assert.equal(mediaPath("/recordings/call_01.mp3"), "/app/recordings/call_01.mp3");
assert.equal(mediaPath("https://example.com/a.mp3"), "https://example.com/a.mp3");
assert.equal(mediaPath("/app/recordings/call_01.mp3"), "/app/recordings/call_01.mp3");
assert.equal(callAudioApiPath("call_01"), "/api/calls/call_01/audio");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "call-audio-"));
process.env.CALL_AUDIO_DIR = dir;
const bytes = Uint8Array.from([1, 2, 3, 4, 5]);
const storedUrl = saveCallAudio("call_demo-1", bytes, "audio/mpeg", "demo.mp3");
assert.equal(storedUrl, "/api/calls/call_demo-1/audio");
const loaded = readCallAudio("call_demo-1");
assert.ok(loaded);
assert.equal(loaded?.mimeType, "audio/mpeg");
assert.deepEqual(Array.from(loaded?.bytes || []), [1, 2, 3, 4, 5]);
assert.equal(readCallAudio("missing"), null);

const turns = parseTranscript(
  `[0:00] David: Hi Dr. Thorne, my name is David Kim with LabSync. How are you today?
[0:06] Dr. Thorne: I'm busy. What is this regarding?
[0:36] David: Absolutely Dr. Thorne, I'll send that right over to your inbox. Have a great day!`,
  44
);
assert.equal(turns[0].timestampSeconds, 0);
assert.equal(turns[1].timestampSeconds, 6);
assert.equal(turns[2].speaker, "David");
assert.match(turns[2].text, /I'll send that right over/);

fs.rmSync(dir, { recursive: true, force: true });
console.log("call audio store checks passed");

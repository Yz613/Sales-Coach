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

async function run(): Promise<void> {
  const file = new File(["Rep: Hi\nProspect: Busy"], "paste.txt", { type: "text/plain" });
  const ingested = await ingestCallFile(file);
  assert.equal(ingested.source, "text");
  assert.match(ingested.transcriptText, /Prospect: Busy/);
}

run()
  .then(() => console.log("ingestCallFile checks passed"))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

import assert from "node:assert/strict";
import { findTurnForQuote, parseLeadingTimestamp, parseTranscript } from "./transcript";

const stamped = parseLeadingTimestamp("[1:12] David: I'll send that");
assert.ok(stamped);
assert.equal(stamped?.seconds, 72);
assert.equal(stamped?.rest, "David: I'll send that");

const colon = parseLeadingTimestamp("0:18 - Greg: We already got a quote");
assert.equal(colon?.seconds, 18);

const transcript = `David: Hi Dr. Thorne, my name is David Kim with LabSync. How are you today?
Dr. Thorne: I'm busy. What is this regarding?
David: I was calling to introduce our state of the art lab automation software that helps biotech labs increase throughput by 40%.
Dr. Thorne: We already have a LIMS system and we don't need anything new right now.
David: Oh okay, no problem! What system are you currently using if you don't mind me asking?
Dr. Thorne: Benchling. Just send me an email with some brochures and I'll keep it on file.
David: Absolutely Dr. Thorne, I'll send that right over to your inbox. Have a great day!`;

const turns = parseTranscript(transcript, 110);
assert.equal(turns.length, 7);
assert.equal(turns[0].timestamp, "0:00");
assert.equal(turns[turns.length - 1].timestampSeconds > 0, true);
assert.equal(turns[turns.length - 1].speaker, "David");

const fold = findTurnForQuote(turns, "Absolutely Dr. Thorne, I'll send that right over to your inbox. Have a great day!");
assert.ok(fold);
assert.ok((fold?.text || "").includes("I'll send that right over"));

const already = findTurnForQuote(turns, "We already have a LIMS system and we don't need anything new right now.");
assert.equal(already?.speaker, "Dr. Thorne");

console.log("transcript checks passed");

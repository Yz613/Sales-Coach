import assert from "node:assert/strict";
import { formatMethodologyBlock } from "./methodology";
import { METHOD_CHOICES, methodById, scoreMethodDebrief } from "./salesMethods";

assert.deepEqual(METHOD_CHOICES.map((choice) => choice.id), ["sandler", "meddic", "challenger", "spin", "bant"]);

const meddic = methodById("meddic");
assert.equal(meddic.pillars.map((pillar) => pillar.label).join(","), "Metrics,Economic Buyer,Decision Criteria");
assert.match(meddic.narrative || "", /MEDDIC/);
assert.ok((meddic.checklist || []).some((item) => item.id === "meddicChampion"));
const prompt = formatMethodologyBlock(meddic);
assert.match(prompt, /meddicChampion/);
assert.doesNotMatch(prompt, /dummyCurve/);

const scored = scoreMethodDebrief(meddic, "We have no champion and no metric.", "Rep");
assert.ok(scored.every((mark) => mark.status === "Handled" || mark.status === "Gap"));
assert.equal(scored.find((mark) => mark.id === "meddicMetrics")?.status, "Gap");
assert.equal(scored.find((mark) => mark.id === "meddicChampion")?.status, "Handled");

const sandler = scoreMethodDebrief(methodById("sandler"), "Rep: Hello.", "Rep");
assert.ok(sandler.length > 20);
assert.ok(sandler.some((mark) => mark.highlight));
assert.ok(sandler.filter((mark) => mark.status !== "Handled").every((mark) => mark.status === "Gap"));

console.log("sales method checks passed");

import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEMO_CALLS, DEMO_DISABLED_ACTIONS, demoCallById, demoOverallScore } from "./workspace";

const VENDOR_NAME = /\b(Clerk|Stripe|Cloudflare|OpenAI|Whisper|Resend|Tailwind|Next\.js|Gemini|Groq|Anthropic|DeepSeek|OpenRouter|Docker|SQLite|PostHog|IPinfo|Google Analytics|HubSpot|Fathom|Salesforce|Zoom)\b/;

describe("public demo workspace", () => {
  it("ships 3 to 5 fictional calls with a scorecard, notes, and trackers", () => {
    assert.ok(DEMO_CALLS.length >= 3 && DEMO_CALLS.length <= 5);
    const ids = new Set(DEMO_CALLS.map((call) => call.id));
    assert.equal(ids.size, DEMO_CALLS.length);
    for (const call of DEMO_CALLS) {
      assert.ok(call.transcriptText.includes("[0:00]"));
      assert.ok(call.scorecard.length >= 4);
      assert.ok(call.coaching.praiseReinforcement.length > 40);
      assert.ok(call.coaching.tacticalGaps.length > 40);
      assert.ok(call.coaching.remedialDrills.length > 40);
      assert.ok(call.trackers.length >= 1);
      assert.ok(call.trackers.every((tracker) => tracker.hits.length >= 1));
      assert.ok(demoOverallScore(call) > 0 && demoOverallScore(call) <= 10);
      for (const item of call.scorecard) {
        if (!item.cite) continue;
        assert.ok(call.transcriptText.includes(item.cite.quote), `${call.id} missing cite ${item.cite.quote}`);
      }
      for (const tracker of call.trackers) {
        for (const hit of tracker.hits) {
          assert.ok(call.transcriptText.includes(hit.quote), `${call.id} tracker ${tracker.id}`);
        }
      }
      assert.equal(VENDOR_NAME.test(`${call.company} ${call.repName} ${call.prospectName} ${call.transcriptText}`), false);
    }
    assert.equal(demoCallById("missing"), undefined);
    assert.equal(demoCallById(DEMO_CALLS[0].id)?.id, DEMO_CALLS[0].id);
    assert.deepEqual(DEMO_DISABLED_ACTIONS.map((action) => action.id), ["rescore", "ask", "comment", "share"]);
  });

  it("renders the demo from fixtures and does not call the model or the database", () => {
    const files = [
      new URL("./workspace.ts", import.meta.url),
      new URL("../../app/demo/page.tsx", import.meta.url),
      new URL("../../app/demo/[id]/page.tsx", import.meta.url),
      new URL("../../components/demo/DemoFrame.tsx", import.meta.url),
    ];
    const source = files.map((file) => readFileSync(file, "utf8")).join("\n");
    const runtimeImports = source
      .split("\n")
      .filter((line) => /^\s*import\s+(?!type\b)/.test(line) && /@\/lib\/(ai|db)\b/.test(line));
    assert.deepEqual(runtimeImports, []);
    assert.equal(source.includes("use server"), false);
    assert.equal(/\bfetch\(/.test(source), false);
    assert.match(source, /Read-only sample/);
    assert.match(source, /disabled/);
    assert.match(source, /DEMO_SIGN_UP_HREF/);
    assert.match(source, /DEMO_SELF_HOST_HREF/);
  });
});

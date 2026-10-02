import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { INTEGRATION_TOOLS } from "./integrations/catalog";
import {
  PUBLIC_INTEGRATION_CATEGORIES,
  PUBLIC_INTEGRATION_COUNT,
  PUBLIC_INTEGRATIONS,
  publicIntegrationGroups,
} from "./publicIntegrations";

const VENDOR_NAME = /\b(Clerk|Stripe|Cloudflare|OpenAI|Whisper|Resend|Tailwind|Next\.js|Gemini|Groq|Anthropic|DeepSeek|OpenRouter|Docker|SQLite)\b/i;
const ROADMAP_ONLY = ["Zoom", "Salesforce", "Dialpad", "Twilio", "Apollo", "Zoho", "Otter", "Avoma", "RingCentral", "Outreach", "Salesloft"];

describe("public integration catalog", () => {
  it("lists every implemented connector and nothing else", () => {
    const catalogIds = INTEGRATION_TOOLS.map((tool) => tool.id).sort();
    const publicIds = PUBLIC_INTEGRATIONS.map((item) => item.id).sort();
    assert.deepEqual(publicIds, catalogIds);
    assert.equal(new Set(publicIds).size, publicIds.length);
    assert.equal(PUBLIC_INTEGRATION_COUNT, 26);
    assert.equal(PUBLIC_INTEGRATIONS.length, 26);
    for (const item of PUBLIC_INTEGRATIONS) {
      const tool = INTEGRATION_TOOLS.find((entry) => entry.id === item.id);
      assert.equal(item.name, tool?.name);
      assert.equal(item.available, true);
      assert.ok(item.description.length > 12);
      assert.ok(item.description.length < 160);
      assert.match(item.logoSrc, /^\/app\/integrations\//);
    }
    const visible = PUBLIC_INTEGRATIONS.map((item) => `${item.name} ${item.description}`).join("\n");
    assert.equal(visible.match(VENDOR_NAME), null);
    for (const name of ROADMAP_ONLY) {
      assert.equal(PUBLIC_INTEGRATIONS.some((item) => item.name === name), false);
    }
  });

  it("groups the current library into the public categories", () => {
    const groups = publicIntegrationGroups();
    assert.deepEqual(groups.map((group) => group.category), [...PUBLIC_INTEGRATION_CATEGORIES]);
    const counts = Object.fromEntries(groups.map((group) => [group.category, group.items.length]));
    assert.deepEqual(counts, {
      Meetings: 6,
      CRM: 3,
      Calendar: 3,
      Tasks: 10,
      Chat: 2,
      Automation: 2,
    });
    assert.deepEqual(
      groups.find((group) => group.category === "Meetings")?.items.map((item) => item.name),
      ["Fathom", "Fireflies", "tl;dv", "Gong", "Close", "Aircall"]
    );
    assert.deepEqual(
      groups.find((group) => group.category === "CRM")?.items.map((item) => item.id),
      ["hubspot", "pipedrive", "attio"]
    );
    assert.equal(groups.flatMap((group) => group.items).length, 26);
  });
});

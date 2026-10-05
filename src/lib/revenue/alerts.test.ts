import assert from "node:assert/strict";
import { test } from "node:test";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AuthUser } from "../auth";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sales-alerts-"));
process.env.SALES_COACH_DB_PATH = path.join(dir, "test.db");
process.env.INTEGRATION_ENCRYPTION_KEY = randomBytes(32).toString("base64");
process.env.PUBLIC_APP_URL = "https://coach.example.com";

test("concept hits keep real quotes and score thresholds stay exclusive", async () => {
  const { acceptConceptHits, scoreNeedsAlert, buildSegments } = await import("./alerts");
  const segments = buildSegments("[0:12] Pat Buyer: This costs too much for our budget this year.\n[0:28] Alex Rep: I can send a comparison sheet.", 60);
  const hits = acceptConceptHits({
    trackers: [{ id: "price", name: "Pricing objection", speaker: "buyer" }],
    segments, repName: "Alex Rep",
    parsed: { hits: [
      { trackerId: "price", start: 99, quote: "This costs too much for our budget this year.", reason: "Cost pushback" },
      { trackerId: "price", start: 28, quote: "I can send a comparison sheet.", reason: "Rep line" },
      { trackerId: "price", start: 1, quote: "We will buy everything today.", reason: "Invented" },
    ] },
  });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].start, 12);
  assert.equal(hits[0].speaker, "Pat Buyer");
  assert.equal(scoreNeedsAlert(4, 5), true);
  assert.equal(scoreNeedsAlert(5, 5), false);
  assert.equal(scoreNeedsAlert(null, 5), false);
});

test("concept trackers mark seekable moments and streams notify Slack, Discord, and the workspace", async () => {
  const { db, ensureRevenueSchema } = await import("../db");
  const schema = await import("../db/schema");
  const { eq } = await import("drizzle-orm");
  const { runWithTenant } = await import("../tenant");
  const { getOrCreateRep, getCallById, getSetting, setSetting } = await import("../db/service");
  const { utcMonthKey } = await import("../billing");
  const { connectIntegration, getConnection } = await import("./connections");
  const { processJobs } = await import("./jobs");
  const { createTracker, conversationDetail, searchConversations } = await import("./conversations");
  const { createConceptTracker, rescanConceptTracker, deleteConceptTracker, createStream, listStreamAlerts, listConceptTrackers, buildSegments } = await import("./alerts");
  const { deleteConversation } = await import("./privacy");
  const auth: AuthUser = { userId: "admin-alerts", role: "admin", isAdmin: true, isMember: false, isClerkConfigured: false, canViewAllCalls: true, tenantId: "org-alerts", clerkPlanId: null, billingPaid: true, name: "Manager" };
  const requests: { url: URL; body: any }[] = [];
  const originalFetch = global.fetch;
  let trackerId = "";
  global.fetch = async (input: any, init?: RequestInit) => {
    const url = new URL(String(input));
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    requests.push({ url, body });
    if (url.hostname === "api.openai.com") {
      assert.equal(body.model, "gpt-4o-mini");
      assert.match(body.messages[1].content, /costs too much/);
      assert.match(body.messages[1].content, /even without saying pricing objection/);
      assert.equal(JSON.stringify(body).includes("sk-test-alerts-key"), false);
      return Response.json({ choices: [{ message: { content: JSON.stringify({ hits: [
        { trackerId, start: 12, quote: "This costs too much for our budget this year.", reason: "Buyer rejects the cost." },
        { trackerId, start: 28, quote: "I can send a comparison sheet.", reason: "Rep speaking" },
        { trackerId, start: 99, quote: "We will buy everything today.", reason: "Invented" },
      ] }) } }], usage: { prompt_tokens: 220, completion_tokens: 60 } });
    }
    if (url.hostname === "hooks.slack.com") return new Response("ok");
    if (url.hostname === "discord.com") return Response.json({ id: "message-1" });
    throw new Error(`Unexpected ${url.hostname}`);
  };
  const drain = async () => { for (let i = 0; i < 12; i++) if (!(await processJobs("org-alerts", 10)).length) return; throw new Error("Alert jobs did not finish"); };
  try {
    await ensureRevenueSchema();
    await runWithTenant("org-alerts", async () => {
      const repId = await getOrCreateRep(undefined, "Alex Rep", "Account Executive", "alex@example.com");
      const callId = "call-alerts-1";
      const transcript = "[0:00] Alex Rep: What matters most this quarter?\n[0:12] Pat Buyer: This costs too much for our budget this year.\n[0:28] Alex Rep: I can send a comparison sheet.\n[0:40] Pat Buyer: We are also talking with Northwind.";
      await db.insert(schema.calls).values({ id: callId, orgId: "org-alerts", repId, prospectCompany: "Acme", prospectName: "Pat Buyer", callStage: "Discovery", coreOutcome: "Meeting booked", durationSeconds: 60, transcriptText: transcript, status: "completed", createdAt: "2026-10-01T15:00:00.000Z" }).run();
      const dealId = "deal-alerts-1";
      await db.insert(schema.crmRecords).values({ id: dealId, orgId: "org-alerts", connectionId: "crm-alerts", provider: "hubspot", externalId: "3", kind: "deal", name: "Acme annual", stage: "Negotiation", amount: "15000", currency: "USD", closed: false, associations: "[]", properties: "{}", syncedAt: "2026-10-01T15:00:00.000Z" }).run();
      await db.insert(schema.callMetadata).values({ callId, orgId: "org-alerts", title: "Acme discovery", source: "upload", participants: "[]", summary: "", actionItems: "[]", segments: JSON.stringify(buildSegments(transcript, 60)), crmRecordIds: JSON.stringify([dealId]), crmMatches: "[]", createdAt: "2026-10-01T15:00:00.000Z" }).run();
      await db.insert(schema.evaluations).values({ id: "eval-alerts-1", orgId: "org-alerts", callId, repId, bottomLine: "Thin discovery", painStatus: "Incomplete", painEvidence: "", budgetStatus: "Fail", budgetEvidence: "", decisionStatus: "Incomplete", decisionEvidence: "", scriptAdherenceScore: 3, scriptFeedback: "Folded on price", missedOpportunities: "[]", topFixes: "[]", rawMarkdown: "", createdAt: "2026-10-01T16:00:00.000Z" }).run();
      await setSetting("ai_provider", "openai");
      await setSetting("active_model", "gpt-4o-mini");
      await setSetting("ai_api_key", "sk-test-alerts-key");
      const slack = await connectIntegration({ provider: "slack", webhookUrl: "https://hooks.slack.com/services/T1/B1/token" }, "admin-alerts");
      const discord = await connectIntegration({ provider: "discord", webhookUrl: "https://discord.com/api/webhooks/123/token" }, "admin-alerts");
      assert.equal((await getConnection(slack)).config.notifyReviewed, false);
      assert.equal((await getConnection(discord)).config.notifyLowScore, false);
      trackerId = await createConceptTracker({ name: "Pricing objection", concept: "The buyer pushes back on price or cost, even without saying pricing objection.", speaker: "buyer" }, "admin-alerts");
      await drain();
      const call = await getCallById(callId);
      const detail = await conversationDetail(call!);
      assert.equal(detail.conceptTrackers.length, 1);
      assert.equal(detail.conceptTrackers[0].hits.length, 1);
      assert.equal(detail.conceptTrackers[0].hits[0].start, 12);
      assert.equal(detail.conceptTrackers[0].hits[0].timing, "provider");
      assert.match(detail.conceptTrackers[0].hits[0].quote, /costs too much/);
      assert.equal((await searchConversations(auth, { aiTracker: trackerId })).total, 1);
      assert.equal((await listConceptTrackers())[0].hits, 1);
      assert.equal(requests.filter(item => item.url.hostname === "api.openai.com").length, 1);
      assert.equal(JSON.parse((await getSetting(`billing:usage:${utcMonthKey()}`)) || "{}").creditsUsed, 1);

      const keywordId = await createTracker({ name: "Competitors", keywords: "Northwind" }, "admin-alerts");
      await createStream({ name: "Pricing objections", type: "concept", trackerId, slack: true, discord: true, inApp: true }, "admin-alerts");
      await createStream({ name: "Northwind mentions", type: "tracker", trackerId: keywordId, slack: true, discord: true, inApp: true }, "admin-alerts");
      await createStream({ name: "Low script scores", type: "low-score", maxScore: 5, slack: true, discord: true, inApp: true }, "admin-alerts");
      await createStream({ name: "Negotiation deals", type: "deal-stage", stage: "Negotiation", slack: true, discord: true, inApp: true }, "admin-alerts");
      await createStream({ name: "Closed won deals", type: "deal-stage", stage: "Closed Won", slack: true, discord: true, inApp: true }, "admin-alerts");
      await drain();
      const alerts = await listStreamAlerts(auth);
      assert.deepEqual(alerts.map((item: any) => item.title).sort(), ["Low script scores", "Negotiation deals", "Northwind mentions", "Pricing objections"]);
      const pricing = alerts.find((item: any) => item.title === "Pricing objections");
      assert.equal(pricing?.startSeconds, 12);
      assert.match(pricing?.body || "", /costs too much/);
      const slackMessages = requests.filter(item => item.url.hostname === "hooks.slack.com");
      const discordMessages = requests.filter(item => item.url.hostname === "discord.com");
      assert.equal(slackMessages.length, 4);
      assert.equal(discordMessages.length, 4);
      assert.equal(JSON.stringify(slackMessages).includes("sk-test-alerts-key"), false);
      const pricingSlack = slackMessages.find(item => JSON.stringify(item.body).includes("costs too much"));
      assert.match(JSON.stringify(pricingSlack?.body), /#t-12/);
      assert.equal(pricingSlack?.body.blocks[1].text.type, "plain_text");
      assert.deepEqual(discordMessages[0].body.allowed_mentions, { parse: [] });
      assert.equal(JSON.stringify(requests).includes("Closed won deals"), false);
      assert.equal(requests.filter(item => item.url.hostname === "api.openai.com").length, 1);
      assert.equal(JSON.parse((await getSetting(`billing:usage:${utcMonthKey()}`)) || "{}").creditsUsed, 1);
      const stranger = { ...auth, userId: "stranger", isAdmin: false, isMember: true, canViewAllCalls: false, email: "stranger@example.com", name: "Stranger" };
      assert.equal((await listStreamAlerts(stranger)).length, 0);
      assert.ok((await listStreamAlerts({ ...stranger, email: "alex@example.com", name: "Alex Rep" })).length >= 4);

      await rescanConceptTracker(trackerId);
      await drain();
      assert.equal(requests.filter(item => item.url.hostname === "api.openai.com").length, 2);
      assert.equal(slackMessages.length, 4);
      assert.equal(requests.filter(item => item.url.hostname === "hooks.slack.com").length, 4);
      assert.equal((await listStreamAlerts(auth)).length, 4);
      assert.equal(JSON.parse((await getSetting(`billing:usage:${utcMonthKey()}`)) || "{}").creditsUsed, 2);
    });
    await runWithTenant("org-b", async () => {
      assert.equal((await listConceptTrackers()).length, 0);
      assert.equal((await listStreamAlerts(auth)).length, 0);
      assert.equal((await searchConversations(auth, { aiTracker: trackerId })).total, 0);
      await assert.rejects(() => deleteConceptTracker(trackerId));
    });
    await runWithTenant("org-alerts", async () => {
      const call = await getCallById("call-alerts-1");
      await deleteConversation(call!.id, "admin-alerts");
      assert.equal((await db.select().from(schema.aiTrackerHits).where(eq(schema.aiTrackerHits.orgId, "org-alerts")).all()).length, 0);
      assert.equal((await db.select().from(schema.streamNotifications).where(eq(schema.streamNotifications.orgId, "org-alerts")).all()).length, 0);
      await deleteConceptTracker(trackerId);
      assert.equal((await listConceptTrackers()).length, 0);
    });
  } finally { global.fetch = originalFetch; }
});

import assert from "node:assert/strict";
import { test, after } from "node:test";
import { createHash, createHmac, randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { INTEGRATION_TOOLS } from "./catalog";
import { normalizeAutomationMeeting } from "./meeting";

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sales-integrations-"));
process.env.SALES_COACH_DB_PATH = path.join(directory, "test.db");
process.env.INTEGRATION_ENCRYPTION_KEY = randomBytes(32).toString("base64");
process.env.PUBLIC_APP_URL = "https://coach.example.com";
after(() => fs.rmSync(directory, { recursive: true, force: true }));
const fireflies = { id: "ff-1", title: "Discovery", date: Date.now(), duration: 1, organizer_email: "alex@example.com", participants: ["alex@example.com", "pat@acme.com"], sentences: [{ speaker_name: "Alex", text: "What is your budget?", start_time: 0, end_time: 10 }], summary: { overview: "Initial summary", action_items: "Send proposal" }, transcript_url: "https://app.fireflies.ai/view/ff-1" };
const tldv = { id: "tl-1", name: "Discovery", happenedAt: "2026-10-01T14:00:00Z", duration: 60, organizer: { name: "Alex", email: "alex@example.com" }, invitees: [{ name: "Pat", email: "pat@acme.com" }], url: "https://tldv.io/app/meetings/tl-1" };
const gong = { metaData: { id: "123", title: "Discovery", started: "2026-10-01T14:00:00Z", duration: 60, url: "https://app.gong.io/call?id=123" }, parties: [{ speakerId: "1", name: "Alex", emailAddress: "alex@example.com", affiliation: "Internal" }, { speakerId: "2", name: "Pat", emailAddress: "pat@acme.com", affiliation: "External" }] };
const close = { id: "activity-1", user_id: "user-1", contact_id: "contact-1", user_name: "Alex", date_created: "2026-10-01T14:00:00Z", lead_id: "lead-1", duration: 60, recording_transcript: { utterances: [{ speaker_label: "Alex", speaker_side: "close-user", start: 1, end: 10, text: "What is your budget?" }], summary_text: "Close summary" } };
const fathom = { recording_id: 321, title: "Live discovery", recording_start_time: "2026-10-01T14:00:00Z", recording_end_time: "2026-10-01T14:01:00Z", recorded_by: { name: "Alex", email: "alex@example.com" }, transcript: [{ speaker: { display_name: "Alex" }, text: "What is your budget?", timestamp: "00:00:00" }] };
let dealAmount = "1000"; let deletedDeal = false; let updatedSummary = false;
const requests: { url: URL; init?: RequestInit }[] = [];
async function vendorFetch(input: any, init?: RequestInit) {
  assert.equal(init?.redirect, "manual", "Cloudflare rejects redirect:error; provider credentials must never follow a redirect");
  const url = new URL(String(input)); requests.push({ url, init });
  if (url.hostname === "api.fireflies.ai") {
    assert.equal((init?.headers as any).Authorization, "Bearer api-token");
    const query = JSON.parse(String(init?.body)).query;
    return Response.json({ data: query.includes("transcript(id:") ? { transcript: { ...fireflies, summary: { ...fireflies.summary, overview: updatedSummary ? "Updated summary" : "Initial summary" } } } : { transcripts: [{ id: fireflies.id }] } });
  }
  if (url.hostname === "pasta.tldv.io") {
    assert.equal((init?.headers as any)["x-api-key"], "api-token");
    return Response.json(url.pathname.endsWith("/transcript") ? { data: [{ speaker: "Alex", text: "What is your budget?", startTime: 3, endTime: 10 }] } : { results: [tldv], pages: 1 });
  }
  if (url.hostname === "api.gong.io") {
    assert.equal((init?.headers as any).Authorization, `Basic ${Buffer.from("api-token:gong-secret").toString("base64")}`);
    return Response.json(url.pathname.endsWith("/transcript") ? { callTranscripts: [{ callId: "123", transcript: [{ speakerId: "1", sentences: [{ text: "What is your budget?", start: 2000, end: 10000 }] }] }] } : { calls: [gong], records: {} });
  }
  if (url.hostname === "api.close.com") {
    if (url.pathname.includes("/user/")) return Response.json({ first_name: "Alex", last_name: "Rep", email: "alex@example.com" });
    if (url.pathname.includes("/contact/")) return Response.json({ name: "Pat", emails: [{ email: "pat@acme.com" }] });
    return Response.json({ data: [close, { id: "not-transcribed" }], has_more: false });
  }
  if (url.hostname === "api.pipedrive.com") {
    assert.equal((init?.headers as any)["x-api-token"], "api-token"); assert.equal(url.searchParams.has("api_token"), false);
    const name = url.pathname.split("/").at(-1);
    return Response.json({ data: name === "stages" ? [{ id: 9, name: "Qualified" }] : name === "organizations" ? [{ id: 1, name: "Acme" }] : name === "persons" ? [{ id: 2, name: "Pat", emails: [{ value: "pat@acme.com", primary: true }], org_id: 1 }] : [{ id: 3, title: "Acme deal", stage_id: 9, value: 1000, currency: "USD", org_id: 1, person_id: 2, status: "open" }], additional_data: {} });
  }
  if (url.hostname === "api.attio.com") {
    const name = url.pathname.split("/")[3];
    return Response.json({ data: [{ id: { record_id: name + "-1" }, web_url: "https://app.attio.com/record/1", values: name === "companies" ? { name: [{ value: "Acme" }], domains: [{ domain: "acme.com" }] } : name === "people" ? { name: [{ full_name: "Pat" }], email_addresses: [{ email_address: "pat@acme.com" }] } : { name: [{ value: "Acme deal" }], stage: [{ status: { title: "Qualified" } }], value: [{ currency_value: 2000, currency_code: "USD" }], associated_company: [{ target_object: "companies", target_record_id: "companies-1" }], associated_people: [{ target_object: "people", target_record_id: "people-1" }] } }] });
  }
  if (url.hostname === "api.hubapi.com") {
    if (url.pathname === "/integrations/v1/me") return Response.json({ hubId: 999 });
    if (url.pathname.includes("pipelines")) return Response.json({ results: [{ stages: [{ id: "qualified", label: "Qualified", metadata: { isClosed: "false" } }] }] });
    if (url.pathname.endsWith("/44")) return deletedDeal ? new Response("gone", { status: 404 }) : Response.json({ id: 44, properties: { dealname: "Live deal", dealstage: "qualified", amount: dealAmount, deal_currency_code: "USD" } });
    return Response.json({ results: [] });
  }
  if (url.hostname === "api.fathom.ai") {
    if (url.pathname.endsWith("/webhooks")) return Response.json({ id: "hook-1", secret: "whsec_" + Buffer.from("12345678901234567890123456789012").toString("base64") });
    if (url.pathname.endsWith("/transcript")) return Response.json({ transcript: fathom.transcript });
    return Response.json({ items: [] });
  }
  throw new Error("Unexpected provider host");
}
async function withVendors(fn: () => Promise<void>) { const original = global.fetch; global.fetch = vendorFetch; try { await fn(); } finally { global.fetch = original; } }

test("incoming call payloads reject missing transcripts, invalid IDs, and invalid timestamps", () => {
  assert.equal(INTEGRATION_TOOLS.length, 10);
  assert.throws(() => normalizeAutomationMeeting({ externalId: "call-1" }), /Transcript/);
  assert.throws(() => normalizeAutomationMeeting({ externalId: "", transcriptText: "hello" }), /Source call ID/);
  assert.throws(() => normalizeAutomationMeeting({ externalId: "1", segments: [{ speaker: "Alex", text: "hello", start: -1 }] }), /timestamps/);
  const meeting = normalizeAutomationMeeting({ externalId: "1", segments: [{ speaker: "Alex", text: "hello", start: 5, end: 10 }] });
  assert.match(meeting.transcriptText, /0:05/); assert.equal(meeting.durationSeconds, 10);
});

test("HubSpot v1/v3 and Fireflies signatures reject tampering, expired signatures, and account mismatches", async () => {
  const { verifyHubspotWebhook, verifyFirefliesWebhook, hubspotEventObjects } = await import("./live");
  const body = '[{"portalId":999,"subscriptionType":"deal.creation","objectId":44}]'; const secret = "app-secret";
  const url = "https://coach.example.com/app/api/webhooks/hubspot?connection=abc"; const timestamp = String(Date.now());
  const signature = createHmac("sha256", secret).update(`POST${url}${body}${timestamp}`).digest("base64");
  const headers = new Headers({ "x-hubspot-signature-v3": signature, "x-hubspot-request-timestamp": timestamp });
  assert.ok(verifyHubspotWebhook(secret, headers, body, url)); assert.ok(!verifyHubspotWebhook(secret, headers, body + " ", url));
  assert.ok(!verifyHubspotWebhook(secret, headers, body, url, "POST", Date.now() + 301000));
  assert.ok(verifyHubspotWebhook(secret, new Headers({ "x-hubspot-signature-version": "v1", "x-hubspot-signature": createHash("sha256").update(secret + body).digest("hex") }), body, url));
  const ffHeaders = new Headers({ "x-hub-signature": `sha256=${createHmac("sha256", secret).update(body).digest("hex")}` });
  assert.ok(verifyFirefliesWebhook(secret, ffHeaders, body)); assert.ok(!verifyFirefliesWebhook(secret, ffHeaders, body + " "));
  assert.throws(() => hubspotEventObjects([{ portalId: 1, objectId: 44, subscriptionType: "deal.creation" }], "999"), /another HubSpot account/);
});

test("all native adapters import calls/CRM, preserve sources, and link calls to deals", async () => withVendors(async () => {
  const { runWithTenant } = await import("../tenant"); const { ensureRevenueSchema } = await import("../db");
  const { connectIntegration, getConnection } = await import("../revenue/connections"); const { enqueueSync, enqueueJob, processJobs } = await import("../revenue/jobs");
  const { conversationDetail, searchConversations } = await import("../revenue/conversations"); const { crmOverview } = await import("../revenue/crm");
  const { getCallById } = await import("../db/service"); const { importedCallId } = await import("../revenue/imports");
  await ensureRevenueSchema();
  await runWithTenant("org-native", async () => {
    for (const provider of ["fireflies", "tldv", "gong", "close", "pipedrive", "attio"] as const) {
      const id = await connectIntegration({ provider, token: "api-token", apiSecret: "gong-secret" }, "admin");
      await enqueueSync(id); await processJobs("org-native", 10);
      if (["fireflies", "tldv", "gong", "close"].includes(provider)) {
        const externalId = { fireflies: "ff-1", tldv: "tl-1", gong: "123", close: "activity-1" }[provider as "fireflies" | "tldv" | "gong" | "close"];
        const call = await getCallById(importedCallId("org-native", id, externalId)); assert.ok(call, provider);
        const detail = await conversationDetail(call); assert.equal(detail.source, provider); assert.equal(detail.segments.length, 1);
        if (provider === "gong") assert.equal(detail.segments[0].start, 2);
        if (provider === "close") assert.equal(detail.participants[0].email, "alex@example.com");
        assert.equal((await getConnection(id)).status, "connected");
        const transcriptRequests = () => requests.filter(req => req.url.pathname.endsWith("/transcript") || String(req.init?.body).includes("transcript(id:")).length;
        const before = transcriptRequests();
        await enqueueJob({ kind: "sync", connectionId: id, payload: { syncStartedAt: new Date().toISOString() }, key: `${id}:overlap-check` });
        await processJobs("org-native", 10);
        assert.equal(transcriptRequests(), before, "incremental overlap does not refetch existing transcripts");
      }
    }
    const overview = await crmOverview(); assert.equal(overview.deals.length, 2); assert.equal(overview.totals.USD, 3000);
    assert.equal(overview.deals[0].stage, "Qualified"); assert.ok(overview.deals.every((deal: any) => deal.linkedCalls.length >= 2));
    assert.ok(requests.some(req => req.url.hostname === "api.close.com" && req.url.searchParams.get("_fields")?.includes("recording_transcript")));
  });
}));

test("live call feeds are immediate, deduplicated, tenant scoped, and revoked on disconnect", async () => withVendors(async () => {
  const { runWithTenant } = await import("../tenant"); const { connectIntegration, disconnectIntegration, getConnection } = await import("../revenue/connections");
  const { enableLiveFeed, acceptLiveWebhook } = await import("./live"); const { enqueueJob, processJobs } = await import("../revenue/jobs");
  const { importedCallId } = await import("../revenue/imports"); const { getCallById } = await import("../db/service");
  await runWithTenant("org-live", async () => {
    for (const provider of ["zapier", "make"] as const) {
      const id = await connectIntegration({ provider }, "admin"); const feed = await enableLiveFeed(id, "admin");
      const body = JSON.stringify({ externalId: "same-call", repName: "Alex", transcriptText: "Alex: What is your budget?" });
      const headers = new Headers({ authorization: `Bearer ${feed.token}` });
      await assert.rejects(() => acceptLiveWebhook(provider, id, new Headers(), body, feed.url), /signature|token/);
      await enqueueJob({ kind: "sync", connectionId: "missing", key: provider + "-old-backfill" });
      const first = await acceptLiveWebhook(provider, id, headers, body, feed.url); const again = await acceptLiveWebhook(provider, id, headers, body, feed.url);
      assert.equal(first.jobId, again.jobId); assert.equal((await processJobs("org-live", 1, [first.jobId!]))[0].status, "completed");
      const callId = importedCallId("org-live", id, "same-call"); assert.ok(await getCallById(callId));
      assert.ok((await getConnection(id)).config.lastWebhookAt);
      await runWithTenant("org-stranger", async () => { assert.equal(await getCallById(callId), null); await assert.rejects(() => getConnection(id)); });
      await disconnectIntegration(id, "admin"); await assert.rejects(() => acceptLiveWebhook(provider, id, headers, body, feed.url), /not found/);
    }
    const id = await connectIntegration({ provider: "fathom", token: "api-token" }, "admin"); await enableLiveFeed(id, "admin");
    const connection = await getConnection(id); const body = JSON.stringify({ ...fathom, transcript: [] }); const timestamp = String(Math.floor(Date.now() / 1000));
    const key = Buffer.from(connection.secrets.webhookSecret.slice(6), "base64");
    const headers = new Headers({ "webhook-id": "evt-1", "webhook-timestamp": timestamp, "webhook-signature": `v1,${createHmac("sha256", key).update(`evt-1.${timestamp}.${body}`).digest("base64")}` });
    const accepted = await acceptLiveWebhook("fathom", id, headers, body, connection.config.webhookUrl!);
    await processJobs("org-live", 1, [accepted.jobId!]); assert.ok(await getCallById(importedCallId("org-live", id, "321")));
    const before = requests.length; await enableLiveFeed(id, "admin"); assert.equal(requests.length, before, "Fathom registration is idempotent");
  });
}));

test("HubSpot events update just changed deals, reconcile deletions, and reject another portal", async () => withVendors(async () => {
  const { runWithTenant } = await import("../tenant"); const { connectIntegration } = await import("../revenue/connections");
  const { enableLiveFeed, acceptLiveWebhook } = await import("./live"); const { processJobs } = await import("../revenue/jobs"); const { crmOverview } = await import("../revenue/crm");
  await runWithTenant("org-hub-live", async () => {
    const id = await connectIntegration({ provider: "hubspot", token: "api-token" }, "admin");
    const feed = await enableLiveFeed(id, "admin", undefined, "hub-secret");
    const deliver = async (amount: string, event: string) => {
      dealAmount = amount; const body = JSON.stringify([{ eventId: event, portalId: 999, subscriptionType: "deal.propertyChange", objectId: 44 }]);
      const headers = new Headers({ "x-hubspot-signature-version": "v1", "x-hubspot-signature": createHash("sha256").update("hub-secret" + body).digest("hex") });
      const result = await acceptLiveWebhook("hubspot", id, headers, body, feed.url); await processJobs("org-hub-live", 1, [result.jobId!]);
    };
    await deliver("1000", "a"); assert.equal((await crmOverview()).totals.USD, 1000);
    await deliver("4000", "b"); assert.equal((await crmOverview()).totals.USD, 4000);
    deletedDeal = true; await deliver("4000", "c"); assert.equal((await crmOverview()).deals.length, 0); deletedDeal = false;
  });
}));

test("Fireflies summary-ready events enrich calls while preserving manager review and completed actions", async () => withVendors(async () => {
  const { runWithTenant } = await import("../tenant"); const { connectIntegration } = await import("../revenue/connections"); const { importedCallId } = await import("../revenue/imports");
  const { enableLiveFeed, acceptLiveWebhook } = await import("./live"); const { processJobs } = await import("../revenue/jobs"); const { db } = await import("../db");
  const { callMetadata } = await import("../db/schema"); const { eq } = await import("drizzle-orm");
  await runWithTenant("org-fireflies-live", async () => {
    const id = await connectIntegration({ provider: "fireflies", token: "api-token" }, "admin"); const feed = await enableLiveFeed(id, "admin");
    const deliver = async (event: string) => {
      const raw = JSON.stringify({ event, meeting_id: fireflies.id, timestamp: Date.now() });
      const headers = new Headers({ "x-hub-signature": `sha256=${createHmac("sha256", feed.token!).update(raw).digest("hex")}` });
      const accepted = await acceptLiveWebhook("fireflies", id, headers, raw, feed.url); await processJobs("org-fireflies-live", 1, [accepted.jobId!]);
    };
    await deliver("meeting.transcribed"); const callId = importedCallId("org-fireflies-live", id, fireflies.id);
    const old = await db.select().from(callMetadata).where(eq(callMetadata.callId, callId)).get();
    await db.update(callMetadata).set({ reviewedAt: "2026-10-01T15:00:00Z", actionItems: JSON.stringify(JSON.parse(old.actionItems).map((a: any) => ({ ...a, completed: true }))) }).where(eq(callMetadata.callId, callId)).run();
    updatedSummary = true; await deliver("meeting.summarized"); updatedSummary = false;
    const fresh = await db.select().from(callMetadata).where(eq(callMetadata.callId, callId)).get();
    assert.equal(fresh.summary, "Updated summary"); assert.equal(fresh.reviewedAt, old.reviewedAt || "2026-10-01T15:00:00Z"); assert.ok(JSON.parse(fresh.actionItems)[0].completed);
  });
}));

test("provider pagination retains each API’s cursor and object boundaries", async () => {
  const { callProviderPage } = await import("./call-providers"); const { crmProviderPage } = await import("./crm-providers");
  const original = global.fetch; const seen: { url: URL; body: any }[] = [];
  global.fetch = async (input: any, init?: RequestInit) => {
    const url = new URL(String(input)); const body = init?.body ? JSON.parse(String(init.body)) : {};
    seen.push({ url, body });
    if (url.hostname === "api.fireflies.ai") return Response.json({ data: { transcripts: Array.from({ length: 25 }, (_, i) => ({ id: `ff-${i}` })) } });
    if (url.hostname === "pasta.tldv.io") return Response.json({ results: [tldv], pages: 3 });
    if (url.hostname === "api.gong.io") return Response.json({ calls: [gong], records: { cursor: "next-gong" } });
    if (url.hostname === "api.pipedrive.com") return Response.json({ data: [{ id: 3, title: "Deal" }], additional_data: { next_cursor: "next-pipe" } });
    return Response.json({ data: Array.from({ length: 100 }, (_, i) => ({ id: { record_id: `a-${i}` }, values: {} })) });
  };
  try {
    const secrets = { token: "test", apiSecret: "test" };
    const ff = await callProviderPage("fireflies", secrets, { after: "25", createdAfter: "2026-09-30T00:00:00Z" });
    assert.equal(ff.next.after, "50"); assert.equal(ff.next.complete, false); assert.equal(seen.at(-1)!.body.variables.skip, 25);
    const tl = await callProviderPage("tldv", secrets, { after: "2" }); assert.equal(tl.next.after, "3"); assert.equal(tl.next.complete, false);
    const g = await callProviderPage("gong", secrets, { after: "old-cursor" }); assert.equal(g.next.after, "next-gong"); assert.equal(seen.at(-1)!.body.cursor, "old-cursor");
    const pipe = await crmProviderPage("pipedrive", "test", { kind: 2, after: "pipe-cursor", stages: {} }, "org", "conn");
    assert.equal(pipe.next.kind, 2); assert.equal(pipe.next.after, "next-pipe"); assert.equal(seen.at(-1)!.url.searchParams.get("cursor"), "pipe-cursor");
    const attio = await crmProviderPage("attio", "test", { kind: 1, after: "100" }, "org", "conn");
    assert.equal(attio.next.kind, 1); assert.equal(attio.next.after, "200"); assert.equal(seen.at(-1)!.body.offset, 100);
  } finally { global.fetch = original; }
});

test("only supported POST webhook paths bypass interactive workspace authentication", async () => {
  const { isPublicApiRoute } = await import("../public-path");
  for (const provider of ["fathom", "hubspot", "fireflies", "zapier", "make"]) {
    assert.ok(isPublicApiRoute(`/app/api/webhooks/${provider}`, "POST"));
    assert.ok(!isPublicApiRoute(`/app/api/webhooks/${provider}`, "GET"));
  }
  assert.ok(!isPublicApiRoute("/app/api/webhooks/unknown", "POST"));
  assert.ok(!isPublicApiRoute("/app/api/integrations", "POST"));
});

test("CRM matching keeps numeric source IDs scoped to their provider", async () => {
  const { matchesCrmRecord } = await import("../revenue/matching");
  const hub = { kind: "contact", provider: "hubspot", externalId: "1", email: "pat@acme.com" };
  const pipe = { ...hub, provider: "pipedrive", email: "another@acme.com" };
  assert.ok(matchesCrmRecord(hub, { kind: "contact", externalId: "1" }));
  assert.ok(!matchesCrmRecord(pipe, { kind: "contact", externalId: "1" }));
  assert.ok(matchesCrmRecord(pipe, { kind: "contact", externalId: "1", provider: "pipedrive" }));
  assert.ok(matchesCrmRecord({ ...pipe, email: "PAT@ACME.COM" }, { kind: "contact", email: "pat@acme.com" }));
});

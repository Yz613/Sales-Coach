import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { INTEGRATION_TOOLS } from "./catalog";
import { INTEGRATION_LOGOS } from "./logos";
import { integrationCapabilities } from "./capabilities";
import { automationDestination, createCrmNote } from "./outbound";
import { normalizeGongCall, GONG_CONTENT_SELECTOR } from "./gong";
import { normalizedMeeting } from "./meeting";

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sales-gong-workflows-"));
process.env.SALES_COACH_DB_PATH = path.join(directory, "test.db");
process.env.INTEGRATION_ENCRYPTION_KEY = randomBytes(32).toString("base64");
process.env.PUBLIC_APP_URL = "https://coach.example.com";
after(() => fs.rmSync(directory, { recursive: true, force: true }));
const now = new Date().toISOString();
const gong = { metaData: { id: "gong-call", title: "Acme discovery", started: now, duration: 60, primaryUserId: "owner", url: "https://app.gong.io/call?id=1" }, parties: [
  { userId: "manager", speakerId: "1", name: "Manager", emailAddress: "manager@company.com", affiliation: "Internal" },
  { id: "participant-owner", userId: "owner", speakerId: "2", name: "Alex", emailAddress: "alex@company.com", affiliation: "Internal" },
  { speakerId: "3", name: "Pat", emailAddress: "pat@acme.com", affiliation: "External", context: [{ system: "HubSpot", objects: [{ objectType: "Contact", objectId: "2" }] }] },
], context: [{ system: "HubSpot", objects: [{ objectType: "Opportunity", objectId: "3" }, { objectType: "Account", objectId: "1", fields: [{ name: "Name", value: "Acme" }] }] }],
content: { brief: "Budget and next steps confirmed", keyPoints: [{ text: "Budget is approved" }], highlights: [{ title: "Next Steps", items: [{ text: "Send proposal", startTimes: [12] }, { text: "Send proposal", startTimes: [12] }] }, { title: "Questions", items: [{ text: "How do reports work?", startTimes: [5] }] }], outline: [{ section: "Discovery", startTime: 0, items: [{ text: "Discussed budget" }] }], topics: [{ name: "Pricing", duration: 14 }], trackers: [{ name: "Competitor", occurrences: [{ startTime: 8, speakerId: "3" }, { startTime: 10, speakerId: "3" }], phrases: [{ phrase: "Acme Rival", occurrences: [{ startTime: 8, speakerId: "3" }] }] }], callOutcome: { name: "Meeting booked" } }, interaction: { speakers: [{ id: "participant-owner", userId: "owner", talkTime: 30 }], interactionStats: [{ name: "Talk Ratio", value: 0.5 }], questions: { companyCount: 4, nonCompanyCount: 0 } } };
const transcript = [{ speakerId: "2", sentences: [{ text: "What is your budget?", start: 2000, end: 10000 }] }, { speakerId: "3", sentences: [{ text: "Budget is approved.", start: 11000, end: 18000 }] }];
let lateBrief = false; let failure = 0; let malformed = false;
const requests: { url: URL; init?: RequestInit; body: any }[] = [];
async function vendorFetch(input: any, init?: RequestInit) {
  const url = new URL(String(input)); const body = init?.body ? JSON.parse(String(init.body)) : null;
  requests.push({ url, init, body }); assert.equal(init?.redirect, "manual");
  if (url.hostname === "api.gong.io") {
    assert.equal((init?.headers as any).Authorization, `Basic ${Buffer.from("key:secret").toString("base64")}`);
    if (url.pathname.endsWith("/transcript")) return Response.json({ callTranscripts: [{ callId: "gong-call", transcript }] });
    assert.deepEqual(body.contentSelector, GONG_CONTENT_SELECTOR);
    return Response.json({ calls: [{ ...gong, content: lateBrief ? { ...gong.content, brief: "Updated brief" } : gong.content }, { ...gong, metaData: { ...gong.metaData, id: "private", isPrivate: true } }], records: {} });
  }
  if (failure) return new Response("vendor error never logged", { status: failure, headers: failure === 429 ? { "Retry-After": "120" } : {} });
  if (url.hostname === "api.hubapi.com") return Response.json(malformed ? {} : { id: `note-${requests.length}` });
  if (url.hostname === "api.pipedrive.com") return Response.json(malformed ? { success: false } : { success: true, data: { id: requests.length } });
  if (url.hostname === "api.attio.com") return Response.json(malformed ? { data: {} } : { data: { id: { note_id: `note-${requests.length}` } } });
  if (url.hostname === "hooks.slack.com") return new Response("ok");
  if (url.hostname === "discord.com") return Response.json({ id: "message" });
  if (url.hostname === "hooks.zapier.com" || url.hostname === "hook.eu1.make.com") return new Response("accepted");
  throw new Error(`Unexpected provider host: ${url.hostname}`);
}
async function withVendors(fn: () => Promise<void>) { const original = global.fetch; global.fetch = vendorFetch; failure = 0; malformed = false; try { await fn(); } finally { global.fetch = original; } }
async function seedConnection(provider: string, orgId: string, config = {}) {
  const { db, ensureRevenueSchema } = await import("../db"); const { integrationConnections } = await import("../db/schema"); const { encryptCredentials } = await import("../revenue/security");
  await ensureRevenueSchema(); const id = `${orgId}-${provider}`;
  const secrets = { token: provider === "gong" ? "key" : "token", apiSecret: "secret", webhookUrl: provider === "discord" ? "https://discord.com/api/webhooks/123/token" : "https://hooks.slack.com/services/T1/B1/token", outboundWebhookUrl: provider === "zapier" ? "https://hooks.zapier.com/hooks/catch/123/token/" : "https://hook.eu1.make.com/token" };
  await db.insert(integrationConnections).values({ id, orgId, provider, name: provider, credentials: encryptCredentials(secrets, `${orgId}:${id}`), config: JSON.stringify({ writeEnabled: true, autoSync: false, autoEvaluate: false, defaultStage: "First Discovery", ...config }), createdAt: now, updatedAt: now }).run();
  return id;
}
async function seedCall(label: string) {
  const { importMeeting } = await import("../revenue/imports");
  return (await importMeeting({ id: "fixture-call-source", provider: "fathom", config: { defaultStage: "First Discovery" } }, normalizedMeeting({ externalId: label, title: `Discovery ${label}`, repName: "Alex", repEmail: "alex@company.com", transcriptText: "Alex: What is your budget?", summary: '<script>alert("x")</script> Budget confirmed', actionItems: [{ id: "action", description: "Send proposal", completed: false }] }))).callId;
}
async function seedTarget(connectionId: string, callId: string, kind = "deal") {
  const { db } = await import("../db"); const { crmRecords, callMetadata } = await import("../db/schema"); const { currentTenantId } = await import("../tenant");
  const orgId = currentTenantId(); const id = `${connectionId}-${kind}`;
  const { getConnection } = await import("../revenue/connections"); const provider = (await getConnection(connectionId)).provider;
  await db.insert(crmRecords).values({ id, orgId, connectionId, provider, externalId: kind === "deal" ? "123" : kind === "contact" ? "124" : "125", kind, name: "Acme", stage: "Qualified", amount: "5000", currency: "USD", syncedAt: now }).onConflictDoNothing().run();
  const meta = await db.select().from(callMetadata).where(eq(callMetadata.callId, callId)).get();
  await db.update(callMetadata).set({ crmRecordIds: JSON.stringify([...JSON.parse(meta.crmRecordIds), id]) }).where(eq(callMetadata.callId, callId)).run();
  return id;
}
async function drain(orgId: string) {
  const { processJobs } = await import("../revenue/jobs");
  for (let i = 0; i < 30; i++) if (!(await Promise.all([1, 2, 3, 4].map(() => processJobs(orgId, 10)))).flat().length) return;
  throw new Error("Jobs did not drain");
}

test("all 32 integration brands resolve to safe local assets and have clear capabilities", () => {
  assert.deepEqual(Object.keys(INTEGRATION_LOGOS).sort(), INTEGRATION_TOOLS.map(t => t.id).sort());
  for (const tool of INTEGRATION_TOOLS) {
    const asset = fs.readFileSync(path.join(process.cwd(), "public/integrations", INTEGRATION_LOGOS[tool.id]));
    assert.ok(asset.length > 100, tool.id);
    if (INTEGRATION_LOGOS[tool.id].endsWith(".svg")) { const svg = asset.toString(); assert.match(svg, /<svg/); assert.doesNotMatch(svg, /<script|<foreignObject|href=["']https?:/i); }
    else assert.ok(asset.subarray(0, 4).equals(Buffer.from([137, 80, 78, 71])) || asset.subarray(0, 4).equals(Buffer.from([0, 0, 1, 0])), tool.id);
    const capabilities = integrationCapabilities(tool.id); assert.ok(capabilities.features.length >= 4); assert.ok(capabilities.scope.length > 20);
  }
});

test("Gong keeps current insights, stable Next Steps, CRM references, the primary rep, and exact timing", () => {
  const call = normalizeGongCall(gong, transcript);
  assert.equal(call.repName, "Alex"); assert.equal(call.summary, gong.content.brief); assert.equal(call.segments[0].start, 2);
  assert.equal(call.prospectCompany, "Acme"); assert.ok(call.crmMatches.some(m => m.kind === "deal" && m.provider === "hubspot" && m.externalId === "3"));
  assert.equal(call.actionItems.length, 1); assert.equal(call.actionItems[0].timestamp, 12);
  assert.equal(normalizeGongCall({ ...gong, content: { ...gong.content, highlights: [...gong.content.highlights].reverse() } }, transcript).actionItems[0].id, call.actionItems[0].id);
  assert.equal(call.providerInsights?.outcome, "Meeting booked"); assert.equal(call.providerInsights?.speakers[0].name, "Alex"); assert.equal(call.providerInsights?.metrics[0].value, 0.5);
  assert.deepEqual(call.providerInsights?.trackers[0].occurrences, [{ start: 8, phrase: "Acme Rival" }, { start: 10, phrase: "Competitor" }]);
  assert.deepEqual(call.providerInsights?.metrics.slice(1), [{ name: "Company questions", value: 4 }, { name: "Customer questions", value: 0 }]);
  assert.throws(() => normalizeGongCall(gong, []), /Transcript/);
  assert.ok(!("pointsOfInterest" in GONG_CONTENT_SELECTOR.exposedFields.content));
});

test("Gong private calls stay excluded and late briefs enrich without refetching or resetting completed actions", async () => withVendors(async () => {
  const { runWithTenant } = await import("../tenant"); const { enqueueSync, enqueueJob, processJobs } = await import("../revenue/jobs");
  const { getCallById } = await import("../db/service"); const { conversationDetail } = await import("../revenue/conversations"); const { importedCallId } = await import("../revenue/imports");
  const { db } = await import("../db"); const { callMetadata } = await import("../db/schema");
  await runWithTenant("org-gong-rich", async () => {
    const id = await seedConnection("gong", "org-gong-rich"); await enqueueSync(id); await processJobs("org-gong-rich", 10);
    const callId = importedCallId("org-gong-rich", id, "gong-call"); const call = await getCallById(callId); assert.ok(call);
    assert.equal(await getCallById(importedCallId("org-gong-rich", id, "private")), null);
    const detail = await conversationDetail(call); const actions = detail.actionItems.map((a: any) => ({ ...a, completed: true }));
    await db.update(callMetadata).set({ actionItems: JSON.stringify(actions), reviewedAt: now }).where(eq(callMetadata.callId, callId)).run();
    const before = requests.filter(r => r.url.pathname.endsWith("/transcript")).length; lateBrief = true;
    await enqueueJob({ kind: "sync", connectionId: id, payload: { syncStartedAt: now }, key: "late-insights" }); await processJobs("org-gong-rich", 10);
    const enriched = await conversationDetail(call); assert.equal(enriched.summary, "Updated brief"); assert.equal(enriched.actionItems[0].completed, true); assert.equal(enriched.reviewedAt, now);
    assert.equal(requests.filter(r => r.url.pathname.endsWith("/transcript")).length, before);
    await runWithTenant("org-other", async () => assert.equal(await getCallById(callId), null));
    lateBrief = false;
  });
}));

test("CRM exports use all nine correct target associations and escape provider markup", async () => withVendors(async () => {
  for (const provider of ["hubspot", "pipedrive", "attio"]) for (const kind of ["company", "contact", "deal"]) {
    await createCrmNote(provider, "token", { kind, externalId: "123" }, { title: "Call", text: '<script>alert("x")</script>\n[admin](javascript:evil)', createdAt: now, callUrl: "https://coach.example.com/app/calls/123" });
    const request = requests.at(-1)!; assert.match(JSON.stringify(request.body), /Open Sales Coach call/);
    if (provider === "hubspot") { assert.equal(request.body.associations[0].types[0].associationTypeId, ({ company: 190, contact: 202, deal: 214 } as any)[kind]); assert.doesNotMatch(request.body.properties.hs_note_body, /<script>/); }
    if (provider === "pipedrive") { assert.equal(request.body[({ company: "org_id", contact: "person_id", deal: "deal_id" } as any)[kind]], 123); assert.ok(!request.url.searchParams.has("api_token")); assert.doesNotMatch(request.body.content, /<script>/); }
    if (provider === "attio") { assert.equal(request.body.data.format, "markdown"); assert.equal(request.body.data.parent_object, ({ company: "companies", contact: "people", deal: "deals" } as any)[kind]); assert.match(request.body.data.content, /\\\[admin/); }
  }
}));

test("300 CRM exports survive 3,000 duplicate requests and four concurrent workers without duplicate notes", async () => withVendors(async () => {
  const { runWithTenant } = await import("../tenant"); const { queueCallExport } = await import("../revenue/exports"); const { db } = await import("../db"); const { integrationExports } = await import("../db/schema");
  await runWithTenant("org-export-stress", async () => {
    const before = requests.length;
    for (const provider of ["hubspot", "pipedrive", "attio"]) {
      const id = await seedConnection(provider, "org-export-stress");
      for (let i = 0; i < 100; i++) { const callId = await seedCall(`${provider}-${i}`); const targetId = await seedTarget(id, callId); await Promise.all(Array.from({ length: 10 }, () => queueCallExport(id, callId, "admin", targetId))); }
    }
    await drain("org-export-stress");
    const rows = await db.select().from(integrationExports).where(eq(integrationExports.orgId, "org-export-stress")).all();
    assert.equal(rows.length, 300); assert.ok(rows.every((r: any) => r.status === "completed")); assert.equal(requests.length - before, 300);
    await drain("org-export-stress"); assert.equal(requests.length - before, 300);
  });
}));

test("uncertain or malformed CRM writes require destination review; rate limits retry and revoked sources cancel", async () => withVendors(async () => {
  const { runWithTenant } = await import("../tenant"); const { queueCallExport, retryCallExport, listCallExports } = await import("../revenue/exports");
  const { enqueueJob, processJobs } = await import("../revenue/jobs"); const { db } = await import("../db"); const { integrationExports, processingJobs, callMetadata } = await import("../db/schema");
  const { deleteConversation } = await import("../revenue/privacy"); const { disconnectIntegration } = await import("../revenue/connections");
  await runWithTenant("org-export-failure", async () => {
    const id = await seedConnection("hubspot", "org-export-failure");
    for (const mode of [503, "malformed"] as const) {
      const callId = await seedCall(`failure-${mode}`); const target = await seedTarget(id, callId); const row = await queueCallExport(id, callId, "admin", target);
      failure = typeof mode === "number" ? mode : 0; malformed = mode === "malformed"; const before = requests.length;
      assert.equal((await processJobs("org-export-failure", 1, [row.jobId]))[0].status, "failed"); failure = 0; malformed = false;
      assert.equal((await listCallExports(id)).find((r: any) => r.id === row.exportId)?.status, "uncertain");
      await enqueueJob({ kind: "export-call", connectionId: id, callId, payload: { exportId: row.exportId }, key: `replay-${mode}` }); await drain("org-export-failure"); assert.equal(requests.length - before, 1);
      await assert.rejects(() => retryCallExport(id, row.exportId, false, "admin"), /confirm/);
      const retry = await retryCallExport(id, row.exportId, true, "admin"); await processJobs("org-export-failure", 1, [retry.jobId]); assert.equal(requests.length - before, 2);
    }
    const callId = await seedCall("rate-limit"); const targetId = await seedTarget(id, callId); const row = await queueCallExport(id, callId, "admin", targetId);
    failure = 429; assert.equal((await processJobs("org-export-failure", 1, [row.jobId]))[0].status, "queued");
    const delayed = await db.select().from(processingJobs).where(eq(processingJobs.id, row.jobId)).get(); assert.ok(Date.parse(delayed.availableAt) >= Date.now() + 110000);
    failure = 0; await db.update(processingJobs).set({ availableAt: now }).where(eq(processingJobs.id, row.jobId)).run(); await processJobs("org-export-failure", 1, [row.jobId]);
    const crashedCall = await seedCall("crashed-worker"); const crashedTarget = await seedTarget(id, crashedCall); const crashed = await queueCallExport(id, crashedCall, "admin", crashedTarget);
    await db.update(integrationExports).set({ status: "sending" }).where(eq(integrationExports.id, crashed.exportId)).run(); const beforeCrash = requests.length;
    assert.equal((await processJobs("org-export-failure", 1, [crashed.jobId]))[0].status, "failed"); assert.equal(requests.length, beforeCrash);
    assert.equal((await listCallExports(id)).find((r: any) => r.id === crashed.exportId)?.canRetry, true);
    const crashRetry = await retryCallExport(id, crashed.exportId, true, "admin"); await processJobs("org-export-failure", 1, [crashRetry.jobId]); assert.equal(requests.length, beforeCrash + 1);
    for (const revoke of ["unlink", "delete", "disconnect"]) {
      const callId = await seedCall(revoke); const targetId = await seedTarget(id, callId); const queued = await queueCallExport(id, callId, "admin", targetId); const before = requests.length;
      if (revoke === "unlink") await db.update(callMetadata).set({ crmRecordIds: "[]" }).where(eq(callMetadata.callId, callId)).run();
      if (revoke === "delete") await deleteConversation(callId, "admin");
      if (revoke === "disconnect") await disconnectIntegration(id, "admin");
      await processJobs("org-export-failure", 1, [queued.jobId]); assert.equal(requests.length, before);
      if (revoke === "unlink") assert.equal((await db.select().from(integrationExports).where(eq(integrationExports.id, queued.exportId)).get()).status, "cancelled");
    }
  });
}));

test("outbound catch hooks reject credential forwarding, private hosts, foreign providers, and redirects", () => {
  for (const url of ["http://hooks.zapier.com/hooks/catch/1/key", "https://localhost/hooks/catch/1/key", "https://127.0.0.1/hooks/catch/1/key", "https://hooks.zapier.com.evil.com/hooks/catch/1/key", "https://user:pass@hooks.zapier.com/hooks/catch/1/key", "https://hooks.zapier.com/hooks/catch/1/key?x=1", "https://hooks.zapier.com:444/hooks/catch/1/key"]) assert.throws(() => automationDestination("zapier", url));
  assert.equal(automationDestination("zapier", "https://hooks.zapier.com/hooks/catch/123/key/").hostname, "hooks.zapier.com");
  assert.equal(automationDestination("make", "https://hook.eu1.make.com/key").hostname, "hook.eu1.make.com");
  assert.throws(() => automationDestination("make", "https://hooks.zapier.com/hooks/catch/1/key"));
});

test("review exports prefer a linked deal, reject missing write permissions, and stop when disabled", async () => withVendors(async () => {
  const { runWithTenant } = await import("../tenant"); const { queueIntegrationEvents, listCallExports, retryCallExport } = await import("../revenue/exports");
  const { getConnection, saveConnectionConfig } = await import("../revenue/connections"); const { processJobs } = await import("../revenue/jobs");
  const { db } = await import("../db"); const { callMetadata, processingJobs } = await import("../db/schema");
  await runWithTenant("org-review-export", async () => {
    const id = await seedConnection("hubspot", "org-review-export", { exportReviewed: true }); const callId = await seedCall("review");
    const deal = await seedTarget(id, callId); await seedTarget(id, callId, "contact"); await seedTarget(id, callId, "company");
    await db.update(callMetadata).set({ reviewedAt: now }).where(eq(callMetadata.callId, callId)).run();
    await queueIntegrationEvents("call.reviewed", callId, now); const rows = await listCallExports(id);
    assert.equal(rows.length, 1); assert.equal(rows[0].targetId, deal);
    const job = await db.select().from(processingJobs).where(eq(processingJobs.connectionId, id)).get(); failure = 403;
    assert.equal((await processJobs("org-review-export", 1, [job.id]))[0].status, "failed"); failure = 0;
    assert.equal((await listCallExports(id))[0].status, "failed");
    const retry = await retryCallExport(id, rows[0].id, true, "admin"); const connection = await getConnection(id);
    await saveConnectionConfig(id, { ...connection.config, exportReviewed: false }); const before = requests.length;
    await processJobs("org-review-export", 1, [retry.jobId]); assert.equal(requests.length, before); assert.equal((await listCallExports(id))[0].status, "cancelled");
  });
}));

test("call export endpoints deny members and hide other workspace delivery records", async () => {
  const { GET, POST } = await import("../../app/api/integrations/[id]/exports/route"); const { runWithAuth } = await import("../auth");
  const auth: import("../auth").AuthUser = { userId: "admin", role: "admin", isAdmin: true, isMember: false, isClerkConfigured: true, orgId: "org-export-stress", tenantId: "org-export-stress", canViewAllCalls: true, clerkPlanId: null, billingPaid: true, mfaVerified: true };
  const context = { params: Promise.resolve({ id: "org-export-stress-hubspot" }) };
  const url = "http://localhost/app/api/integrations/org-export-stress-hubspot/exports";
  const member: import("../auth").AuthUser = { ...auth, userId: "member", role: "member", isAdmin: false, isMember: true };
  assert.equal((await runWithAuth(member, () => GET(new Request(url), context))).status, 403);
  assert.equal((await runWithAuth(member, () => POST(new Request(url, { method: "POST", headers: { "Content-Type": "application/json", origin: "http://localhost" }, body: JSON.stringify({ action: "send", callId: "any" }) }), context))).status, 403);
  assert.equal((await runWithAuth({ ...auth, orgId: "org-other", tenantId: "org-other" }, () => GET(new Request(url), context))).status, 404);
  const allowed = await runWithAuth(auth, () => GET(new Request(url), context)); assert.equal(allowed.status, 200); assert.equal((await allowed.json()).exports.length, 100);
});

test("automation triggers honor opt-in, preserve stable delivery IDs through retries, and isolate tenants", async () => withVendors(async () => {
  const { runWithTenant } = await import("../tenant"); const { queueCallExport, queueIntegrationEvents, listCallExports } = await import("../revenue/exports");
  const { processJobs } = await import("../revenue/jobs"); const { saveConnectionConfig, getConnection } = await import("../revenue/connections");
  const { db } = await import("../db"); const { processingJobs, callMetadata } = await import("../db/schema");
  await runWithTenant("org-automation-out", async () => {
    const crmId = await seedConnection("hubspot", "org-automation-out");
    for (const provider of ["zapier", "make"]) {
      const id = await seedConnection(provider, "org-automation-out", { outboundConfigured: true });
      const callId = await seedCall(`auto-${provider}`); assert.equal((await listCallExports(id)).length, 0);
      await seedTarget(crmId, callId);
      const connection = await getConnection(id); await saveConnectionConfig(id, { ...connection.config, outboundOnImported: true, outboundOnReviewed: true });
      await Promise.all(Array.from({ length: 100 }, () => queueIntegrationEvents("call.imported", callId, callId)));
      const row = (await listCallExports(id))[0]; assert.equal((await listCallExports(id)).length, 1);
      const firstJob = await db.select().from(processingJobs).where(and(eq(processingJobs.connectionId, id), eq(processingJobs.callId, callId))).get();
      failure = 503; assert.equal((await processJobs("org-automation-out", 1, [firstJob.id]))[0].status, "queued"); failure = 0;
      const first = requests.at(-1)!; await db.update(processingJobs).set({ availableAt: now }).where(eq(processingJobs.id, firstJob.id)).run(); await processJobs("org-automation-out", 1, [firstJob.id]);
      const second = requests.at(-1)!; assert.equal(first.body.eventId, row.id); assert.equal(second.body.eventId, row.id); assert.equal((second.init?.headers as any)["X-Sales-Coach-Event-Id"], row.id);
      assert.ok(second.body.call.actionItems.length); assert.equal(second.body.call.crmRecords[0].stage, "Qualified"); assert.match(second.body.call.callUrl, /^https:\/\/coach.example.com\/app\/calls\//); assert.ok(!("transcriptText" in second.body.call)); assert.ok(!JSON.stringify(second.body).includes("outboundWebhookUrl"));
      await db.update(callMetadata).set({ reviewedAt: now }).where(eq(callMetadata.callId, callId)).run(); await queueIntegrationEvents("call.reviewed", callId, now);
      await saveConnectionConfig(id, { ...connection.config, outboundOnImported: true, outboundOnReviewed: false }); const before = requests.length; await drain("org-automation-out"); assert.equal(requests.length, before);
      await saveConnectionConfig(id, { ...connection.config, outboundOnImported: false, outboundOnReviewed: false });
      await runWithTenant("org-other", async () => { await assert.rejects(() => queueCallExport(id, callId, "admin"), /not found/); await assert.rejects(() => listCallExports(id), /not found/); });
    }
  });
}));

test("manual Slack and Discord shares include an authenticated clip link without requiring automatic alerts", async () => withVendors(async () => {
  const { runWithTenant } = await import("../tenant"); const { getConnection } = await import("../revenue/connections"); const { sendSlackJob } = await import("./slack");
  const { db } = await import("../db"); const { conversationClips } = await import("../db/schema");
  await runWithTenant("org-manual-share", async () => {
    const callId = await seedCall("shared-call"); const clipId = "clip";
    await db.insert(conversationClips).values({ id: clipId, orgId: "org-manual-share", callId, title: "Strong discovery", startSeconds: 2, endSeconds: 10, createdBy: "admin", createdAt: now }).run();
    for (const provider of ["slack", "discord"]) {
      const id = await seedConnection(provider, "org-manual-share"); const connection = await getConnection(id);
      await sendSlackJob(connection, { callId, payload: JSON.stringify({ event: "share", clipId }) }); const request = requests.at(-1)!;
      assert.match(JSON.stringify(request.body), /#t-2-10/); assert.match(JSON.stringify(request.body), /Strong discovery/);
      if (provider === "discord") assert.deepEqual(request.body.allowed_mentions, { parse: [] });
      if (provider === "slack") assert.equal(request.body.blocks[1].text.type, "plain_text");
    }
    const before = requests.length; await db.delete(conversationClips).where(eq(conversationClips.id, clipId)).run();
    await sendSlackJob(await getConnection("org-manual-share-slack"), { callId, payload: JSON.stringify({ event: "share", clipId }) }); assert.equal(requests.length, before);
  });
}));

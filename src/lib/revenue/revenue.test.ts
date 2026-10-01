import assert from "node:assert/strict";
import { test } from "node:test";
import { createHmac, randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AuthUser } from "../auth";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sales-revenue-"));
process.env.SALES_COACH_DB_PATH = path.join(dir, "test.db");
process.env.INTEGRATION_ENCRYPTION_KEY = randomBytes(32).toString("base64");
process.env.CALL_AUDIO_DIR = path.join(dir, "audio");

const meeting = { recording_id: 101, title: "Acme discovery", created_at: "2026-09-01T10:00:00Z", recording_start_time: "2026-09-01T10:00:00Z", recording_end_time: "2026-09-01T10:01:00Z", recorded_by: { name: "Alex Rep", email: "alex@example.com" }, share_url: "https://fathom.video/share/101", calendar_invitees: [{ name: "Pat", email: "pat@acme.com", is_external: true }], default_summary: { markdown_formatted: "The buyer needs reporting." }, action_items: [{ description: "Send proposal", completed: false, assignee: { name: "Alex" }, recording_timestamp: "00:00:40" }], crm_matches: { contacts: [{ email: "pat@acme.com", record_url: "https://app.hubspot.com/contacts/999/record/0-1/2" }], companies: [{ name: "Acme", record_url: "https://app.hubspot.com/contacts/999/record/0-2/1" }] }, transcript: [{ speaker: { display_name: "Alex Rep" }, text: "What is your budget?", timestamp: "00:00:00" }, { speaker: { display_name: "Pat", matched_calendar_invitee_email: "pat@acme.com" }, text: "We are comparing Gong and need reporting.", timestamp: "00:00:15" }, { speaker: { display_name: "Alex Rep" }, text: "Let's schedule a demo on Tuesday at 10 am.", timestamp: "00:00:40" }] };

test("credentials authenticate workspace and connection; signed webhooks reject tampering and stale replays", async () => {
  const { encryptCredentials, decryptCredentials } = await import("./security");
  const { verifyFathomWebhook, normalizeFathomMeeting, clockSeconds } = await import("../integrations/fathom");
  const secret = randomBytes(32); const body = JSON.stringify(meeting); const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", secret).update(`event-1.${timestamp}.${body}`).digest("base64");
  const headers = new Headers({ "webhook-id": "event-1", "webhook-timestamp": timestamp, "webhook-signature": `v1,invalid v1,${signature}` });
  assert.equal(verifyFathomWebhook(`whsec_${secret.toString("base64")}`, headers, body), true);
  assert.equal(verifyFathomWebhook(`whsec_${secret.toString("base64")}`, headers, body + " "), false);
  assert.equal(verifyFathomWebhook(`whsec_${secret.toString("base64")}`, headers, body, Date.now() + 301000), false);
  const encrypted = encryptCredentials({ token: "private-token" }, "org-a:connection-a");
  assert.ok(!encrypted.includes("private-token")); assert.deepEqual(decryptCredentials(encrypted, "org-a:connection-a"), { token: "private-token" });
  assert.throws(() => decryptCredentials(encrypted, "org-b:connection-a"));
  const normalized = normalizeFathomMeeting(meeting); assert.equal(normalized.durationSeconds, 60); assert.equal(normalized.segments[1].start, 15); assert.equal(normalized.crmMatches[0].externalId, "2"); assert.equal(normalized.actionItems[0].timestamp, 40);
  assert.equal(clockSeconds("01:02:03.5"), 3723.5); assert.throws(() => normalizeFathomMeeting({ recording_id: 3, transcript: [] }));
});

test("imports, CRM links, search, review, clips, job leases, deletion, and tenant boundaries work together", async () => {
  const { db, ensureRevenueSchema } = await import("../db");
  const schema = await import("../db/schema"); const { eq, and } = await import("drizzle-orm");
  const { runWithTenant } = await import("../tenant");
  const { connectIntegration, listConnections, getConnection, disconnectIntegration } = await import("./connections");
  const { enqueueSync, processJobs, listJobs, enqueueJob, retryJob } = await import("./jobs");
  const { getCallById } = await import("../db/service");
  const { searchConversations, updateConversation, createTracker, clipLibrary, listSearches, saveSearch, conversationDetail } = await import("./conversations");
  const { crmOverview } = await import("./crm"); const { accessibleCall } = await import("./access");
  const { deleteConversation, exportConversation, setRetention, purgeExpiredConversations } = await import("./privacy");
  const { importedCallId } = await import("./imports");
  const auth: AuthUser = { userId: "admin-a", role: "admin", isAdmin: true, isMember: false, isClerkConfigured: false, canViewAllCalls: true, tenantId: "local", clerkPlanId: null, billingPaid: true, name: "Manager" };
  const originalFetch = global.fetch; let fail = false; let rateLimited = false; const requests: string[] = [];
  let blockHubspot = false; let providerStarted: () => void; let resumeProvider: () => void;
  const started = new Promise<void>(resolve => { providerStarted = resolve; });
  const resumed = new Promise<void>(resolve => { resumeProvider = resolve; });
  global.fetch = async (input: any, init?: RequestInit) => {
    const url = new URL(String(input)); requests.push(url.pathname + url.search);
    if (rateLimited) return new Response("slow down", { status: 429, headers: { "Retry-After": "120" } });
    if (fail) return new Response("Do not echo private-token", { status: 401 });
    let data: any = {};
    if (url.hostname === "api.hubapi.com") {
      if (blockHubspot) { providerStarted!(); await resumed; }
      assert.equal((init?.headers as any).Authorization, "Bearer hub-token");
      if (url.pathname === "/crm/v3/pipelines/deals") data = { results: [{ stages: [{ id: "qualified", label: "Qualified", metadata: { isClosed: "false" } }] }] };
      else if (url.pathname.endsWith("companies")) data = { results: [{ id: "1", properties: { name: "Acme", domain: "acme.com" } }] };
      else if (url.pathname.endsWith("contacts")) data = { results: [{ id: "2", properties: { firstname: "Pat", email: "pat@acme.com" }, associations: { companies: { results: [{ id: "1" }] } } }] };
      else if (url.pathname.endsWith("deals")) data = { results: [{ id: "3", properties: { dealname: "Acme annual", amount: "15000", deal_currency_code: "USD", dealstage: "qualified", closedate: "2026-09-10T00:00:00Z" }, associations: { contacts: { results: [{ id: "2" }] }, companies: { results: [{ id: "1" }] } } }] };
      else throw new Error(`Unexpected HubSpot path ${url.pathname}`);
    } else if (url.hostname === "api.fathom.ai") {
      assert.equal((init?.headers as any)["X-Api-Key"], "fathom-token");
      if (url.pathname.endsWith("/download")) { assert.equal(init?.method, "POST"); data = { download_id: "dl_test", recording_id: 101, status: "processing" }; }
      else if (url.pathname.endsWith("/transcript")) data = { transcript: meeting.transcript };
      else if (url.pathname.endsWith("/downloads/dl_test")) data = { download_id: "dl_test", recording_id: 101, status: "completed", video: { url: "https://media.fathom.ai/video.mp4", content_type: "video/mp4", expires_at: "2026-10-02T00:00:00Z" } };
      else data = url.searchParams.get("cursor") === "page-2" ? { items: [{ ...meeting, recording_id: 102, title: "Follow up", transcript: [] }] } : { items: [meeting], next_cursor: "page-2" };
    } else throw new Error("Unexpected provider origin");
    return Response.json(data);
  };
  try {
    await ensureRevenueSchema();
    await runWithTenant("org-a", async () => {
      // Import meetings before the CRM to exercise repair of initially unmatched contacts.
      const fathom = await connectIntegration({ provider: "fathom", token: "fathom-token" }, "admin-a");
      const first = await enqueueSync(fathom); assert.equal(await enqueueSync(fathom), first);
      await Promise.all([processJobs("org-a", 5), processJobs("org-a", 5)]);
      const callId = importedCallId("org-a", fathom, "101"); let call = await getCallById(callId); assert.ok(call); assert.equal(call.coreOutcome, "Meeting booked");
      assert.equal((await searchConversations(auth, {})).total, 2);
      const { fathomRecording } = await import("./recording");
      assert.equal((await fathomRecording(callId)).status, "processing");
      assert.equal((await fathomRecording(callId, "dl_test")).url, "https://media.fathom.ai/video.mp4");
      await assert.rejects(() => fathomRecording(callId, "../unsafe"));
      const hubspot = await connectIntegration({ provider: "hubspot", token: "hub-token" }, "admin-a"); await enqueueSync(hubspot); await processJobs("org-a", 5);
      const overview = await crmOverview(); assert.equal(overview.deals.length, 1); assert.equal(overview.totals.USD, 15000); assert.equal(overview.deals[0].linkedCalls.length, 2); assert.equal(overview.deals[0].stage, "Qualified");
      await updateConversation(auth, call, { action: "comment", body: "Good discovery", timestamp: 15 });
      await updateConversation(auth, call, { action: "clip", title: "Budget question", collection: "Discovery", start: 0, end: 15 });
      await updateConversation(auth, call, { action: "review", reviewed: true });
      await updateConversation(auth, call, { action: "override", metricKey: "pain", score: 8, reason: "Buyer gave specific evidence" });
      await updateConversation(auth, call, { action: "toggleAction", id: "fathom_101_0", completed: true });
      const tracker = await createTracker({ name: "Competitors", keywords: "Gong, Chorus" }, "admin-a");
      assert.equal((await searchConversations(auth, { tracker })).total, 2); assert.equal((await searchConversations(auth, { reviewed: "yes" })).total, 1);
      assert.equal((await searchConversations(auth, { q: "comparing Gong" })).total, 2); assert.equal((await searchConversations(auth, { q: "' OR 1=1 --" })).total, 0);
      const detail = await conversationDetail(call); assert.equal(detail.comments.length, 1); assert.equal(detail.overrides[0].score, 8); assert.equal(detail.trackers[0].hits[0].start, 15); assert.equal(detail.actionItems[0].completed, true);
      assert.equal((await clipLibrary(auth)).length, 1);
      const member = { ...auth, userId: "member-a", isAdmin: false, isMember: true, canViewAllCalls: false, email: "alex@example.com", name: "Alex Rep" };
      await accessibleCall(member, callId); assert.equal((await clipLibrary({ ...member, email: "stranger@example.com", name: "Stranger" })).length, 0);
      await assert.rejects(() => accessibleCall({ ...member, email: "stranger@example.com", name: "Stranger" }, callId));
      await assert.rejects(() => updateConversation(member, call!, { action: "override", metricKey: "pain", score: 9, reason: "Self grade" }));
      await assert.rejects(() => updateConversation(auth, call!, { action: "clip", title: "Invalid", start: 20, end: 10 }));
      await saveSearch(auth, { name: "Gong mentions", filters: { q: "Gong", page: "99" } }); assert.equal((await listSearches(auth))[0].filters.page, undefined); assert.equal((await listSearches(member)).length, 0);
      assert.match((await exportConversation(call, "vtt")).content, /00:00:15.000 --> 00:00:40.000/);
      await enqueueSync(fathom, true); await processJobs("org-a", 5); assert.equal((await searchConversations(auth, {})).total, 2); assert.equal((await conversationDetail(call)).comments.length, 1);
      const job = await enqueueJob({ kind: "sync", connectionId: hubspot, key: "bad-token", payload: {} }); fail = true; await processJobs("org-a", 1); fail = false;
      const failed = (await listJobs()).find((j: any) => j.id === job); assert.equal(failed.status, "failed"); assert.ok(!failed.lastError.includes("private-token"));
      await retryJob(job); await processJobs("org-a", 5);
      const delayedId = await enqueueJob({ kind: "sync", connectionId: hubspot, key: "rate-limited", payload: {} });
      rateLimited = true; await processJobs("org-a", 1); rateLimited = false;
      let delayed = await db.select().from(schema.processingJobs).where(eq(schema.processingJobs.id, delayedId)).get();
      assert.equal(delayed.status, "queued"); assert.equal(delayed.attempts, 1); assert.ok(Date.parse(delayed.availableAt) >= Date.now() + 115000);
      assert.equal((await processJobs("org-a", 1)).length, 0);
      await db.update(schema.processingJobs).set({ status: "running", leaseToken: "expired", leaseUntil: "2000-01-01T00:00:00Z" }).where(eq(schema.processingJobs.id, delayedId)).run();
      await processJobs("org-a", 5);
      delayed = await db.select().from(schema.processingJobs).where(eq(schema.processingJobs.id, delayedId)).get(); assert.equal(delayed.status, "completed");
      await runWithTenant("org-b", async () => { assert.equal((await searchConversations(auth, {})).total, 0); assert.equal((await listConnections()).length, 0); await assert.rejects(() => getConnection(hubspot)); await assert.rejects(() => accessibleCall(auth, callId)); await assert.rejects(() => retryJob(job)); });
      const cancelledId = await enqueueJob({ kind: "sync", connectionId: hubspot, key: "disconnect-in-flight", payload: {} });
      blockHubspot = true; const running = processJobs("org-a", 1); await started;
      await disconnectIntegration(hubspot, "admin-a"); blockHubspot = false; resumeProvider!(); await running;
      const disconnected = await db.select().from(schema.integrationConnections).where(eq(schema.integrationConnections.id, hubspot)).get();
      assert.equal(disconnected.status, "disconnected"); assert.equal(disconnected.credentials, "");
      assert.equal((await db.select().from(schema.processingJobs).where(eq(schema.processingJobs.id, cancelledId)).get()).status, "cancelled");
      await deleteConversation(callId, "admin-a"); assert.equal(await getCallById(callId), null); assert.equal((await clipLibrary(auth)).length, 0);
      const connection = await getConnection(fathom); const { importMeeting } = await import("./imports"); const { normalizeFathomMeeting } = await import("../integrations/fathom"); assert.equal((await importMeeting(connection, normalizeFathomMeeting(meeting))).deleted, true);
      assert.equal((await db.select().from(schema.conversationComments).where(eq(schema.conversationComments.callId, callId)).all()).length, 0);
      await setRetention(1, "admin-a"); assert.equal((await purgeExpiredConversations()).deleted, 1);
      await disconnectIntegration(fathom, "admin-a"); await assert.rejects(() => getConnection(fathom));
      assert.equal((await db.select().from(schema.integrationConnections).where(and(eq(schema.integrationConnections.id, fathom), eq(schema.integrationConnections.orgId, "org-a"))).get()).credentials, "");
    });
    assert.ok(requests.some(r => r.includes("cursor=page-2")));
    assert.ok(requests.some(r => r.includes("/recordings/102/transcript")));
  } finally { global.fetch = originalFetch; fs.rmSync(dir, { recursive: true, force: true }); }
});

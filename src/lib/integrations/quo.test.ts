import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { eq } from "drizzle-orm";

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sales-quo-"));
process.env.SALES_COACH_DB_PATH = path.join(directory, "test.db");
process.env.INTEGRATION_ENCRYPTION_KEY = randomBytes(32).toString("base64");
process.env.CALL_AUDIO_DIR = path.join(directory, "audio");
process.env.PUBLIC_APP_URL = "https://coach.example.com";
after(() => fs.rmSync(directory, { recursive: true, force: true }));

const secretA = `whsec_${randomBytes(32).toString("base64")}`;
const secretB = `whsec_${randomBytes(32).toString("base64")}`;
const call = {
  id: "ACabc123", phoneNumberId: "PNnumber1", actorId: "USrep1", direction: "incoming", status: "completed",
  participants: [{ phoneNumber: "+15551230000", actorId: "USrep1" }, { phoneNumber: "(415) 555-0199", actorId: null }],
  answeredAt: "2026-10-01T15:00:00.000Z", answeredBy: "USrep1", createdAt: "2026-10-01T14:59:00.000Z", completedAt: "2026-10-01T15:05:00.000Z", duration: 300,
};
const transcripts = [
  { recordingId: "CRone", status: "completed", startTime: "2026-10-01T15:00:00.000Z", duration: 20, dialogue: [
    { content: "What is your budget?", start: 1, end: 4, actorId: "USrep1", identifier: null },
    { content: "We can do this quarter.", start: 5, end: 9, actorId: null, identifier: "+14155550199" },
  ] },
  { recordingId: "CRtwo", status: "completed", startTime: "2026-10-01T15:00:20.000Z", duration: 10, dialogue: [
    { content: "Send the proposal.", start: 1, end: 3, actorId: "USrep1", identifier: null },
  ] },
];
type RequestLog = { url: URL; method: string; authorization: string | null; version: string | null; body?: any };
let requests: RequestLog[] = [];
let summaryReady = false;
let transcriptMode: "ready" | "absent" | "empty" | "404" | "403" = "ready";
let v1Mode: "ok" | "403" = "ok";
let hookState: "enabled" | "disabled" | "missing" = "enabled";
let hookId = "";
let hookUrl = "";
let recordingMode: "ok" | "429" | "huge" = "ok";

function summary() {
  return summaryReady
    ? { status: "completed", type: "human", summary: ["Budget is approved."], nextSteps: ["Send the proposal"] }
    : { status: "absent", type: null, summary: null, nextSteps: null };
}

function quoFetch(input: RequestInfo | URL, init?: RequestInit): Response | Promise<Response> {
  const url = new URL(String(input));
  const headers = new Headers(init?.headers);
  const authorization = headers.get("authorization");
  const version = headers.get("quo-api-version");
  const method = init?.method || "GET";
  const body = init?.body ? JSON.parse(String(init.body)) : undefined;
  requests.push({ url, method, authorization, version, body });
  assert.equal(init?.redirect, "manual");
  if (url.hostname === "files.example.com") {
    assert.equal(authorization, null);
    if (url.pathname.endsWith("/big.mp3")) return new Response(Uint8Array.from([1]), { headers: { "content-type": "audio/mpeg", "content-length": String(30 * 1024 * 1024) } });
    return new Response(Uint8Array.from([1, 2, 3, 4]), { headers: { "content-type": "audio/mpeg", "content-length": "4" } });
  }
  if (url.hostname !== "api.quo.com") return new Response("no", { status: 404 });
  assert.equal(authorization, "quo-api-key");
  assert.equal(authorization?.startsWith("Bearer "), false);
  if (url.pathname.startsWith("/v1/")) assert.equal(version, null);
  else assert.equal(version, "2026-03-30");
  if (url.pathname === "/users") return Response.json({ data: [{ id: "USrep1", email: "alex@example.com", firstName: "Alex", lastName: "Rep", role: "admin" }] });
  if (url.pathname === "/v1/contacts") {
    if (v1Mode === "403") return new Response(JSON.stringify({ message: "Contacts are not available" }), { status: 403, headers: { "content-type": "application/json" } });
    return Response.json({ data: [{ id: "CTpat", defaultFields: { firstName: "Pat", lastName: "Buyer", company: "Acme", emails: [{ name: "work", value: "pat@acme.com" }], phoneNumbers: [{ name: "mobile", value: "+1 (415) 555-0199" }] } }] });
  }
  if (url.pathname === "/contacts/CTpat") return Response.json({ data: { id: "CTpat", firstName: "Pat", lastName: "Buyer", company: "Acme" } });
  if (url.pathname === "/contacts/CTpat/properties") return Response.json({ data: [{ type: "phone-number", name: "mobile", value: "+14155550199" }, { type: "email", name: "work", value: "pat@acme.com" }] });
  if (url.pathname === "/webhooks" && method === "POST") {
    assert.deepEqual(body.events, ["call.completed", "call.recording.completed", "call.transcript.completed", "call.summary.completed"]);
    assert.deepEqual(body.resourceIds, ["*"]);
    assert.equal(body.status, "enabled");
    hookId = hookId === "99" ? "100" : "99";
    hookUrl = body.url;
    hookState = "enabled";
    return Response.json({ data: { id: hookId, url: hookUrl, events: body.events, resourceIds: ["*"], status: "enabled", key: hookId === "99" ? secretA : secretB } }, { status: 201 });
  }
  if (url.pathname.startsWith("/webhooks/")) {
    if (method === "DELETE") return new Response(null, { status: 204 });
    if (hookState === "missing") return new Response(JSON.stringify({ message: "Webhook not found" }), { status: 404, headers: { "content-type": "application/json" } });
    if (method === "PATCH") {
      assert.deepEqual(body.events, ["call.completed", "call.recording.completed", "call.transcript.completed", "call.summary.completed"]);
      assert.deepEqual(body.resourceIds, ["*"]);
      hookState = "enabled";
      hookUrl = body.url;
      return Response.json({ data: { id: url.pathname.split("/")[2], url: hookUrl, events: body.events, resourceIds: ["*"], status: "enabled" } });
    }
    return Response.json({ data: { id: url.pathname.split("/")[2], url: hookUrl, events: ["call.completed", "call.recording.completed", "call.transcript.completed", "call.summary.completed"], resourceIds: ["*"], status: hookState } });
  }
  if (url.pathname.endsWith("/transcripts")) {
    if (transcriptMode === "404") return new Response("missing", { status: 404 });
    if (transcriptMode === "403") return new Response(JSON.stringify({ message: "Transcripts require Business or Scale", token: "quo-api-key", hint: "whsec_supersecretvalue" }), { status: 403, headers: { "content-type": "application/json" } });
    if (transcriptMode === "absent") return Response.json({ data: [{ recordingId: "CRone", status: "absent", dialogue: null }] });
    if (transcriptMode === "empty") return Response.json({ data: [{ recordingId: "CRone", status: "completed", dialogue: [] }] });
    return Response.json({ data: transcripts });
  }
  if (url.pathname.endsWith("/recordings")) {
    if (recordingMode === "429") return new Response("slow down", { status: 429, headers: { "retry-after": "30" } });
    const file = recordingMode === "huge" ? "https://files.example.com/big.mp3" : "https://files.example.com/quo.mp3";
    return Response.json({ data: [{ id: "CRone", status: "completed", startTime: "2026-10-01T15:00:00.000Z", duration: 20, url: file, type: "audio/mpeg" }] });
  }
  if (url.pathname === "/calls") {
    if (url.searchParams.get("after") === "cursor-2") return Response.json({ data: [], nextCursor: null });
    return Response.json({ data: [{ ...call, summary: summary() }], nextCursor: "cursor-2" });
  }
  if (url.pathname.startsWith("/calls/")) {
    const id = decodeURIComponent(url.pathname.split("/")[2]);
    return Response.json({ data: { ...call, id, summary: summary() } });
  }
  return new Response(JSON.stringify({ message: "missing" }), { status: 404 });
}

async function withQuo(fn: () => Promise<void>) {
  const original = global.fetch;
  global.fetch = quoFetch as typeof fetch;
  try { await fn(); } finally {
    global.fetch = original;
    requests = [];
    summaryReady = false;
    transcriptMode = "ready";
    v1Mode = "ok";
    hookState = "enabled";
    hookId = "";
    hookUrl = "";
    recordingMode = "ok";
    const { clearQuoDirectoryCache } = await import("./quo");
    clearQuoDirectoryCache();
  }
}

function sign(secret: string, id: string, raw: string, timestamp = String(Math.floor(Date.now() / 1000))) {
  const key = Buffer.from(secret.slice("whsec_".length), "base64");
  const digest = createHmac("sha256", key).update(`${id}.${timestamp}.${raw}`).digest("base64");
  return new Headers({ "webhook-id": id, "webhook-timestamp": timestamp, "webhook-signature": `v1,not-the-signature v1,${digest}` });
}

test("Quo signatures accept a current v1 signature and reject stale, tampered, or unsigned deliveries", async () => {
  const { verifyQuoWebhook, quoEventCallId } = await import("./quo");
  const raw = JSON.stringify({ type: "call.completed", data: { resource: { id: "ACabc123" } } });
  assert.equal(verifyQuoWebhook(secretA, sign(secretA, "evt-1", raw), raw), true);
  assert.equal(verifyQuoWebhook(secretA, sign(secretB, "evt-1", raw), raw), false);
  assert.equal(verifyQuoWebhook(secretA, sign(secretA, "evt-1", raw, "1"), raw), false);
  assert.equal(verifyQuoWebhook(secretA, new Headers(), raw), false);
  assert.equal(verifyQuoWebhook(secretA, sign(secretA, "evt-1", `${raw} `), raw), false);
  assert.equal(quoEventCallId({ type: "call.recording.completed", data: { resource: { id: "ACabc123" } } }), "ACabc123");
  assert.equal(quoEventCallId({ type: "call.transcript.completed", data: { resource: { callId: "ACabc123", processingStatus: "completed" } } }), "ACabc123");
  assert.equal(quoEventCallId({ type: "call.summary.completed", data: { resource: { callId: "ACabc123", processingStatus: "absent" } } }), null);
  assert.equal(quoEventCallId({ type: "call.ringing", data: { resource: { id: "ACabc123" } } }), null);
});

test("Quo imports completed calls, recordings, transcripts, summaries, and phone or email CRM matches", async () => withQuo(async () => {
  const { runWithTenant } = await import("../tenant");
  const { connectIntegration, getConnection, disconnectIntegration } = await import("../revenue/connections");
  const { enableLiveFeed, acceptLiveWebhook } = await import("./live");
  const { enqueueSync, enqueueJob, processJobs } = await import("../revenue/jobs");
  const { getCallById } = await import("../db/service");
  const { conversationDetail } = await import("../revenue/conversations");
  const { importedCallId } = await import("../revenue/imports");
  const { readCallAudio } = await import("../callAudioStore");
  const { db } = await import("../db");
  const schema = await import("../db/schema");
  const { deleteQuoWebhook, fetchQuoCall, clearQuoDirectoryCache, quoPage, maybeStoreQuoAudio } = await import("./quo");
  const { normalizePipedriveRecord, normalizeAttioRecord } = await import("./crm-providers");
  const { crmLinkIds, normalizeE164 } = await import("../revenue/matching");
  assert.equal(normalizeE164("(415) 555-0199"), "+14155550199");
  assert.equal(normalizePipedriveRecord({ id: 4, name: "Pat", phones: [{ value: "(415) 555-0199", primary: true }] }, 1, "org", "conn").properties.phone, "+14155550199");
  assert.equal(normalizeAttioRecord({ id: { record_id: "person-1" }, values: { phone_numbers: [{ original_phone_number: "+1 415 555 0199" }] } }, 1, "org", "conn").properties.phone, "+14155550199");
  assert.deepEqual(crmLinkIds([
    { id: "c", kind: "contact", provider: "hubspot", externalId: "1", email: null, properties: { phone: "+14155550199" }, associations: [] },
    { id: "d", kind: "deal", provider: "hubspot", externalId: "2", email: null, associations: ["c"] },
  ], [{ kind: "contact", phone: "4155550199" }], []).sort(), ["c", "d"]);

  await runWithTenant("org-quo", async () => {
    const now = new Date().toISOString();
    const id = await connectIntegration({ provider: "quo", token: "quo-api-key" }, "admin");
    const verify = requests.find(request => request.url.pathname === "/users");
    assert.equal(verify?.url.searchParams.get("limit"), "1");
    assert.equal(verify?.authorization, "quo-api-key");
    assert.equal(verify?.version, "2026-03-30");
    const feed = await enableLiveFeed(id, "admin");
    assert.match(feed.url, /\/api\/webhooks\/quo\?connection=/);
    const created = requests.filter(request => request.url.pathname === "/webhooks" && request.method === "POST");
    assert.equal(created.length, 1);
    assert.equal((await getConnection(id)).secrets.webhookSecret, secretA);
    hookState = "disabled";
    await enableLiveFeed(id, "admin");
    assert.equal(requests.at(-1)?.method, "PATCH");
    hookState = "missing";
    await enableLiveFeed(id, "admin");
    assert.equal(requests.at(-1)?.method, "POST");
    assert.equal((await getConnection(id)).secrets.webhookSecret, secretB);

    await db.insert(schema.crmRecords).values([
      { id: "contact-phone", orgId: "org-quo", connectionId: "crm", provider: "hubspot", externalId: "10", kind: "contact", name: "Pat Phone", properties: JSON.stringify({ phone: "+14155550199" }), syncedAt: now },
      { id: "contact-email", orgId: "org-quo", connectionId: "crm", provider: "hubspot", externalId: "11", kind: "contact", name: "Pat Email", email: "pat@acme.com", syncedAt: now },
      { id: "deal-1", orgId: "org-quo", connectionId: "crm", provider: "hubspot", externalId: "12", kind: "deal", name: "Acme Expansion", associations: JSON.stringify(["contact-phone"]), syncedAt: now },
    ]).run();
    await db.insert(schema.scorecardTemplates).values({ id: "score-quo", orgId: "org-quo", name: "Quo calls", visibility: "managers", autoApply: true, filters: JSON.stringify({ sources: ["quo"] }), createdBy: "admin", createdAt: now, updatedAt: now }).run();
    await db.insert(schema.scorecardQuestions).values({ id: "score-quo-q", orgId: "org-quo", templateId: "score-quo", position: 0, prompt: "Was a next step set?", scale: "pass_fail", createdAt: now }).run();
    await db.insert(schema.aiTrackers).values({ id: "tracker-quo", orgId: "org-quo", name: "Budget", concept: "budget", createdAt: now }).run();

    const syncId = await enqueueSync(id);
    const firstPayload = JSON.parse((await db.select().from(schema.processingJobs).where(eq(schema.processingJobs.id, syncId)).get()).payload);
    assert.equal(firstPayload.createdAfter, undefined);
    await processJobs("org-quo", 10);
    const listed = requests.filter(request => request.url.pathname === "/calls");
    assert.equal(listed[0].url.searchParams.get("status"), "completed");
    assert.equal(listed[0].url.searchParams.get("include"), "summary");
    assert.equal(listed[0].url.searchParams.get("limit"), "50");
    assert.equal(listed.at(-1)?.url.searchParams.get("after"), "cursor-2");
    const gte = Date.parse(listed[0].url.searchParams.get("createdAt[gte]") || "");
    const lte = Date.parse(listed[0].url.searchParams.get("createdAt[lte]") || "");
    assert.ok(Math.abs(lte - gte - 30 * 86400000) < 5000);
    assert.equal(requests.some(request => request.url.pathname === "/v1/contacts" && request.version === null), true);
    const callId = importedCallId("org-quo", id, "ACabc123");
    const imported = await getCallById(callId);
    assert.ok(imported);
    const detail = await conversationDetail(imported);
    assert.equal(detail.source, "quo");
    assert.equal(detail.title, "Quo · Incoming · Pat Buyer");
    assert.equal(detail.summary, "");
    assert.equal(detail.participants.find((person: { external?: boolean }) => person.external)?.email, "pat@acme.com");
    assert.equal(detail.segments[0].speaker, "Alex Rep");
    assert.equal(detail.segments[0].start, 1);
    assert.equal(detail.segments[1].text, "We can do this quarter.");
    assert.equal(detail.segments[2].start, 21);
    assert.equal(imported.durationSeconds, 300);
    assert.equal(detail.participants[0].email, "alex@example.com");
    const metadata = await db.select().from(schema.callMetadata).where(eq(schema.callMetadata.callId, callId)).get();
    const linked = JSON.parse(metadata.crmRecordIds).sort();
    assert.deepEqual(linked, ["contact-email", "contact-phone", "deal-1"]);
    assert.equal((await db.select().from(schema.scorecardApplications).where(eq(schema.scorecardApplications.callId, callId)).all()).length, 1);
    assert.ok((await db.select().from(schema.processingJobs).where(eq(schema.processingJobs.kind, "scan-alerts")).all()).length >= 1);
    const audio = await readCallAudio(callId);
    assert.deepEqual([...(audio?.bytes || [])], [1, 2, 3, 4]);
    assert.equal(requests.some(request => request.url.hostname === "files.example.com" && request.authorization), false);

    summaryReady = true;
    const event = JSON.stringify({ id: "evt-sum", type: "call.summary.completed", data: { resource: { callId: "ACabc123", processingStatus: "completed", summary: ["Budget is approved."], nextSteps: ["Send the proposal"] }, context: { contacts: { ids: ["CTpat"], lookupStatus: "matched" } } } });
    const headers = sign(secretB, "evt-sum", event);
    const beforeProperties = requests.filter(request => request.url.pathname === "/contacts/CTpat/properties").length;
    const first = await acceptLiveWebhook("quo", id, headers, event, feed.url);
    const second = await acceptLiveWebhook("quo", id, headers, event, feed.url);
    assert.equal(first.jobId, second.jobId);
    const queued = await db.select().from(schema.processingJobs).where(eq(schema.processingJobs.id, first.jobId!)).get();
    assert.equal(queued.payload.includes("whsec_"), false);
    assert.equal(queued.payload.includes("CTpat"), true);
    await processJobs("org-quo", 2, [first.jobId!]);
    const again = await getCallById(callId);
    assert.ok(again);
    const enriched = await conversationDetail(again);
    assert.equal(enriched.summary, "Budget is approved.");
    assert.equal(enriched.actionItems[0].description, "Send the proposal");
    assert.equal((await db.select().from(schema.callMetadata).where(eq(schema.callMetadata.connectionId, id)).all()).length, 1);
    assert.ok(requests.filter(request => request.url.pathname === "/contacts/CTpat/properties").length > beforeProperties);
    const recordingEvent = JSON.stringify({ type: "call.recording.completed", data: { resource: { id: "ACabc123" } } });
    const transcriptEvent = JSON.stringify({ type: "call.transcript.completed", data: { resource: { callId: "ACabc123", processingStatus: "in-progress" } } });
    assert.ok((await acceptLiveWebhook("quo", id, sign(secretB, "evt-rec", recordingEvent), recordingEvent, feed.url)).jobId);
    assert.ok((await acceptLiveWebhook("quo", id, sign(secretB, "evt-tr", transcriptEvent), transcriptEvent, feed.url)).jobId);
    const absent = JSON.stringify({ type: "call.transcript.completed", data: { resource: { callId: "ACabc123", processingStatus: "absent" } } });
    assert.equal((await acceptLiveWebhook("quo", id, sign(secretB, "evt-absent", absent), absent, feed.url)).jobId, undefined);
    await assert.rejects(() => acceptLiveWebhook("quo", id, sign(secretB, "evt-sum", event), `${event} `, feed.url), /signature|token/);

    const historyId = await enqueueSync(id, true);
    const history = JSON.parse((await db.select().from(schema.processingJobs).where(eq(schema.processingJobs.id, historyId)).get()).payload);
    assert.equal(history.full, true);
    assert.equal(history.createdAfter, undefined);
    const logged: unknown[][] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => { logged.push(args); };
    try {
      transcriptMode = "403";
      clearQuoDirectoryCache();
      assert.equal(await fetchQuoCall({ token: "quo-api-key" }, { id: "ACmissing" }), null);
      transcriptMode = "absent";
      assert.equal(await fetchQuoCall({ token: "quo-api-key" }, { id: "ACmissing" }), null);
      transcriptMode = "empty";
      assert.equal(await fetchQuoCall({ token: "quo-api-key" }, { id: "ACmissing" }), null);
      transcriptMode = "404";
      assert.equal(await fetchQuoCall({ token: "quo-api-key" }, { id: "ACmissing" }), null);
    } finally { console.error = originalError; transcriptMode = "ready"; }
    const logText = JSON.stringify(logged);
    assert.match(logText, /403/);
    assert.equal(logText.includes("quo-api-key"), false);
    assert.equal(logText.includes("whsec_supersecretvalue"), false);
    transcriptMode = "403";
    const skipped = await enqueueJob({ kind: "fetch-call", connectionId: id, payload: { id: "ACmissing" }, key: "quo-missing" });
    assert.equal((await processJobs("org-quo", 1, [skipped]))[0].status, "completed");
    assert.notEqual((await getConnection(id)).status, "error");
    transcriptMode = "ready";
    v1Mode = "403";
    clearQuoDirectoryCache();
    const phoneOnly = await fetchQuoCall({ token: "quo-api-key" }, { id: "ACabc123" });
    assert.equal(phoneOnly?.crmMatches[0].phone, "+14155550199");
    assert.equal(phoneOnly?.crmMatches[0].email, undefined);
    recordingMode = "huge";
    assert.equal(await maybeStoreQuoAudio({ token: "quo-api-key" }, "missing-audio", "ACabc123"), false);
    recordingMode = "429";
    await assert.rejects(() => maybeStoreQuoAudio({ token: "quo-api-key" }, "missing-audio", "ACabc123"), (error: any) => error.providerStatus === 429);

    await deleteQuoWebhook({ token: "quo-api-key" }, "100");
    assert.equal(requests.at(-1)?.method, "DELETE");
    assert.match(requests.at(-1)?.url.pathname || "", /\/webhooks\/100$/);
    await disconnectIntegration(id, "admin");
    await assert.rejects(() => acceptLiveWebhook("quo", id, headers, event, feed.url), /not found/);
  });

  const original = global.fetch;
  global.fetch = async () => Response.json({ data: { calls: {} } });
  try { await assert.rejects(() => quoPage({ token: "quo-api-key" }, { syncStartedAt: new Date().toISOString() }), /invalid|oversized/); }
  finally { global.fetch = original; }
}));

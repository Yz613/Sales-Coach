import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AuthUser } from "../auth";

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sales-zoom-"));
process.env.SALES_COACH_DB_PATH = path.join(directory, "test.db");
process.env.INTEGRATION_ENCRYPTION_KEY = randomBytes(32).toString("base64");
process.env.CALL_AUDIO_DIR = path.join(directory, "audio");
process.env.PUBLIC_APP_URL = "https://coach.example.com";
process.env.ZOOM_CLIENT_ID = "app-id";
process.env.ZOOM_CLIENT_SECRET = "app-secret";
after(() => fs.rmSync(directory, { recursive: true, force: true }));

const syncStart = "2026-10-05T12:00:00.000Z";
const vtt = "WEBVTT\n\n1\n00:00:01.000 --> 00:00:04.000\nAlex Rep: What is your budget?\n\n2\n00:00:04.200 --> 00:00:08.000\n<v Pat Buyer>We need this next quarter.</v>\n";
const slashId = "/rec//abc==";
const meeting = (uuid: string, extra: Record<string, unknown> = {}) => ({
  uuid, id: 100, topic: uuid === "uuid-b==" ? "Recurring follow-up" : "Discovery", start_time: "2026-10-01T14:00:00Z", duration: 30,
  share_url: "https://zoom.us/rec/share/discovery?access_token=do-not-store", host_id: "host-1", ...extra,
});
const files = (id: string, size = 4) => ({ recording_files: [
  { id: `${id}-audio`, file_type: "M4A", status: "completed", file_size: size, download_url: `https://zoom.us/rec/download/audio-${id}`, recording_type: "audio_only" },
  { id: `${id}-vtt`, file_type: "TRANSCRIPT", status: "completed", file_size: 200, download_url: `https://zoom.us/rec/download/vtt-${id}` },
] });
let mode: "library" | "windows" = "library";
let transcriptReady = false;
let requests: { url: URL; authorization?: string }[] = [];

function decodeZoomId(segment: string): string {
  let value = segment;
  for (let i = 0; i < 2; i++) {
    const next = decodeURIComponent(value);
    if (next === value) break;
    value = next;
  }
  return value;
}

function libraryPage(url: URL) {
  const token = url.searchParams.get("next_page_token");
  const newest = Math.abs(Date.now() - Date.parse(`${url.searchParams.get("to")}T00:00:00Z`)) < 3 * 86400000;
  if (transcriptReady && !token && url.searchParams.get("from") === "2026-09-20") return { meetings: [meeting("uuid-silent", { topic: "Transcript arrived", recording_files: [{ id: "silent-vtt", file_type: "TRANSCRIPT", status: "completed", file_size: 80, download_url: "https://zoom.us/rec/download/vtt-silent" }] })], total_records: 1 };
  if (token === "page-2") return { meetings: [meeting("uuid-a==", files("uuid-a")), meeting("uuid-b==", files("uuid-b", 50_000_000)), meeting(slashId, { topic: "Slash id", recording_files: [{ id: "slash-vtt", file_type: "TRANSCRIPT", status: "completed", file_size: 100, download_url: "https://zoom.us/rec/download/vtt-slash" }] })], next_page_token: "", total_records: 3 };
  if (!token && newest) return { meetings: [meeting("uuid-processing", { recording_files: [{ file_type: "MP4", status: "processing" }] }), meeting("uuid-a==", files("uuid-a"))], next_page_token: "page-2", total_records: 4 };
  return { meetings: [], total_records: 0 };
}

function zoomFetch(input: RequestInfo | URL, init?: RequestInit): Response | Promise<Response> {
  const url = new URL(String(input));
  const authorization = (init?.headers as Record<string, string> | undefined)?.Authorization;
  requests.push({ url, authorization });
  assert.equal(init?.redirect, "manual");
  if (url.hostname === "files.example.com") {
    assert.equal(authorization, undefined);
    return new Response(vtt, { headers: { "content-type": "text/vtt" } });
  }
  if (url.pathname === "/rec/download/private") return new Response(null, { status: 302, headers: { location: "http://127.0.0.1/secret" } });
  if (url.hostname !== "api.zoom.us" && url.hostname !== "zoom.us") return new Response("no", { status: 404 });
  if (authorization) assert.equal(authorization, "Bearer zoom-token");
  if (url.pathname === "/v2/users/me") return Response.json({ id: "user-1", email: "alex@example.com", first_name: "Alex", last_name: "Rep" });
  if (url.pathname === "/v2/users/me/recordings") {
    const from = Date.parse(`${url.searchParams.get("from")}T00:00:00Z`);
    const to = Date.parse(`${url.searchParams.get("to")}T00:00:00Z`);
    assert.ok(to - from <= 30 * 86400000, `${url.searchParams.get("from")} → ${url.searchParams.get("to")}`);
    if (url.searchParams.get("page_size") === "1") return Response.json({ meetings: [], total_records: 0 });
    if (mode === "windows") {
      return Response.json(String(url.searchParams.get("from")).startsWith("2026-09") || String(url.searchParams.get("from")).startsWith("2026-10")
        ? { meetings: [], total_records: 0 }
        : { meetings: [meeting("uuid-window", files("window"))], total_records: 1 });
    }
    return Response.json(libraryPage(url));
  }
  if (url.pathname.includes("/recordings")) {
    const id = decodeZoomId(url.pathname.split("/")[3]);
    if (id === slashId) assert.match(url.pathname, /%252F/);
    const detail = id === "uuid-b==" ? meeting(id, files(id, 50_000_000)) : id === "uuid-silent" ? meeting(id, transcriptReady ? { recording_files: [{ id: "silent-vtt", file_type: "TRANSCRIPT", status: "completed", download_url: "https://zoom.us/rec/download/vtt-silent", file_size: 80 }] } : { recording_files: [{ file_type: "MP4", status: "completed", download_url: "https://zoom.us/rec/download/silent", file_size: 10 }] }) : meeting(id, id === slashId ? { recording_files: [{ id: "slash-vtt", file_type: "TRANSCRIPT", status: "completed", download_url: "https://zoom.us/rec/download/vtt-slash", file_size: 100 }] } : files("uuid-a"));
    return Response.json({ ...detail, download_access_token: "playback-token" });
  }
  if (url.pathname.endsWith("/participants")) {
    const id = decodeZoomId(url.pathname.split("/")[3]);
    if (id !== "uuid-a==") return new Response("{}", { status: 404 });
    return Response.json({ participants: [{ name: "Pat Buyer", user_email: "pat@acme.com" }, { name: "Alex Rep", user_email: "alex@example.com" }], next_page_token: "" });
  }
  if (url.pathname === "/rec/download/vtt-b" || url.pathname.endsWith("/vtt-uuid-b")) return new Response(null, { status: 302, headers: { location: "https://files.example.com/vtt-b.vtt" } });
  if (url.pathname.includes("/vtt-")) return new Response(vtt, { headers: { "content-type": "text/vtt" } });
  if (url.pathname.includes("/audio-")) return new Response(Uint8Array.from([1, 2, 3, 4]), { headers: { "content-type": "audio/mp4", "content-length": "4" } });
  return new Response("missing", { status: 404 });
}

async function withZoom(fn: () => Promise<void>) {
  const original = global.fetch;
  global.fetch = zoomFetch as typeof fetch;
  try { await fn(); } finally { global.fetch = original; requests = []; mode = "library"; transcriptReady = false; }
}

async function drain(orgId: string) {
  const { processJobs } = await import("../revenue/jobs");
  for (let round = 0; round < 40; round++) if (!(await processJobs(orgId, 8)).length) return;
  assert.fail("Zoom sync did not finish");
}

const auth = (tenant: string): AuthUser => ({ userId: "admin", role: "admin", isAdmin: true, isMember: false, isClerkConfigured: false, canViewAllCalls: true, tenantId: tenant, clerkPlanId: null, billingPaid: true, name: "Manager" });

test("Zoom transcript cues keep speaker names and timestamps", async () => {
  const { parseZoomTranscript, zoomPathId } = await import("./zoom");
  const segments = parseZoomTranscript(vtt);
  assert.equal(segments[0].speaker, "Alex Rep"); assert.equal(segments[0].start, 1); assert.equal(segments[0].end, 4);
  assert.equal(segments[1].speaker, "Pat Buyer"); assert.equal(segments[1].start, 4.2); assert.equal(segments[1].text, "We need this next quarter.");
  assert.equal(zoomPathId(slashId), encodeURIComponent(encodeURIComponent(slashId)));
  assert.equal(zoomPathId("uuid-a=="), encodeURIComponent("uuid-a=="));
  const { zoomDownload } = await import("./zoom");
  await withZoom(async () => {
    await assert.rejects(() => zoomDownload("zoom-token", "https://zoom.us/rec/download/private", 1000, "text/plain"), /invalid download|redirected|404|request failed/);
  });
});

test("Zoom history walks month windows, imports each recording once, and isolates tenants", async () => {
  const { zoomPage } = await import("./zoom");
  const { runWithTenant } = await import("../tenant");
  const { connectIntegration, disconnectIntegration } = await import("../revenue/connections");
  const { enqueueSync, enqueueJob, processJobs, listJobs } = await import("../revenue/jobs");
  const { importedCallId } = await import("../revenue/imports");
  const { getCallById } = await import("../db/service");
  const { searchConversations, conversationDetail } = await import("../revenue/conversations");
  const { providerRecording } = await import("../revenue/recording");
  const { readCallAudio } = await import("../callAudioStore");
  const { db } = await import("../db");
  const { evaluations, processingJobs } = await import("../db/schema");
  const { eq } = await import("drizzle-orm");
  const secrets = { token: "zoom-token", authType: "oauth", refreshToken: "refresh", expiresAt: String(Date.now() + 3600000) };
  await withZoom(async () => {
    mode = "windows";
    const first = await zoomPage(secrets, { syncStartedAt: syncStart, createdAfter: "2026-08-01T00:00:00.000Z" });
    assert.equal(first.deferred.length, 0); assert.equal(first.next.complete, false);
    assert.match(first.next.after || "", /^zoom-window:/);
    const second = await zoomPage(secrets, first.next);
    assert.equal(second.deferred.length, 1); assert.equal(second.deferred[0].id, "uuid-window");
    const listed = requests.filter(request => request.url.pathname === "/v2/users/me/recordings" && request.url.searchParams.get("page_size") !== "1");
    assert.equal(listed.length, 2);
    for (const request of listed) {
      const span = Date.parse(`${request.url.searchParams.get("to")}T00:00:00Z`) - Date.parse(`${request.url.searchParams.get("from")}T00:00:00Z`);
      assert.ok(span <= 30 * 86400000);
    }
    assert.notEqual(listed[0].url.searchParams.get("from"), listed[1].url.searchParams.get("from"));
    mode = "library"; requests = [];
    const previousClef = process.env.CLEF_EVALUATION_MODE; const previousBilling = process.env.BILLING_REQUIRED;
    process.env.CLEF_EVALUATION_MODE = "off"; process.env.BILLING_REQUIRED = "false";
    try {
      let callA = ""; let callB = "";
      await runWithTenant("org-zoom-a", async () => {
        const id = await connectIntegration({ provider: "zoom", autoEvaluate: true, autoSync: true }, "admin", secrets);
        assert.equal((await (await import("../revenue/connections")).getConnection(id)).config.accountEmail, "alex@example.com");
        await enqueueSync(id); await processJobs("org-zoom-a", 1);
        const queued = (await db.select().from(processingJobs).where(eq(processingJobs.orgId, "org-zoom-a")).all()).filter((job: { status: string; kind: string }) => job.status === "queued" && job.kind === "fetch-call");
        assert.ok(queued.length >= 1);
        assert.equal(queued.map((job: { payload: string }) => job.payload).join("\n").includes("download_url"), false);
        await drain("org-zoom-a");
        callA = importedCallId("org-zoom-a", id, "uuid-a==");
        const call = await getCallById(callA); assert.ok(call);
        const detail = await conversationDetail(call);
        assert.equal(detail.source, "zoom"); assert.equal(detail.title, "Discovery");
        assert.equal(detail.segments[0].start, 1); assert.equal(detail.segments[1].speaker, "Pat Buyer");
        assert.equal(detail.participants.find((person: { email?: string }) => person.email === "pat@acme.com")?.external, true);
        assert.equal(detail.recordingPageUrl?.includes("access_token"), false);
        assert.equal((await searchConversations(auth("org-zoom-a"), { source: "zoom" })).total, 3);
        assert.equal(await getCallById(importedCallId("org-zoom-a", id, "uuid-processing")), null);
        assert.equal(await getCallById(importedCallId("org-zoom-a", id, "uuid-silent")), null);
        const stored = await readCallAudio(callA); assert.deepEqual([...(stored?.bytes || [])], [1, 2, 3, 4]);
        callB = importedCallId("org-zoom-a", id, "uuid-b==");
        assert.equal((await getCallById(callB))?.audioUrl, undefined);
        const playback = await providerRecording(callB);
        assert.ok(playback.url);
        assert.equal(playback.status, "completed"); assert.match(playback.url, /^https:\/\/zoom\.us\//); assert.match(playback.url, /access_token=playback-token/);
        assert.equal(playback.url.includes("zoom-token"), false);
        const payloads = (await db.select().from(processingJobs).where(eq(processingJobs.orgId, "org-zoom-a")).all()).map((job: { payload: string }) => job.payload).join("\n");
        assert.equal(payloads.includes("playback-token"), false); assert.equal(payloads.includes("download_url"), false);
        assert.equal((await db.select().from(evaluations).where(eq(evaluations.callId, callA)).all()).length, 1);
        await enqueueSync(id); await drain("org-zoom-a");
        assert.equal((await searchConversations(auth("org-zoom-a"), { source: "zoom" })).total, 3);
        transcriptReady = true;
        await enqueueJob({ kind: "sync", connectionId: id, payload: { syncStartedAt: syncStart, createdAfter: "2026-09-20T00:00:00.000Z" }, key: "transcript-later" });
        await drain("org-zoom-a");
        assert.ok(await getCallById(importedCallId("org-zoom-a", id, "uuid-silent")));
        assert.equal((await searchConversations(auth("org-zoom-a"), { source: "zoom" })).total, 4);
      });
      await runWithTenant("org-zoom-b", async () => {
        const id = await connectIntegration({ provider: "zoom", autoEvaluate: false }, "admin", secrets);
        await enqueueSync(id); await drain("org-zoom-b");
        const own = await getCallById(importedCallId("org-zoom-b", id, "uuid-a==")); assert.ok(own);
        assert.equal(await getCallById(callA), null);
        await assert.rejects(() => providerRecording(callA), /no recording/);
        assert.equal((await searchConversations(auth("org-zoom-b"), { source: "zoom" })).total, 3);
      });
      await runWithTenant("org-zoom-a", async () => assert.equal(await getCallById(importedCallId("org-zoom-b", "missing", "uuid-a==")), null));
      await runWithTenant("org-zoom-stop", async () => {
        const id = await connectIntegration({ provider: "zoom", autoSync: true }, "admin", secrets);
        await enqueueSync(id); await processJobs("org-zoom-stop", 1);
        await disconnectIntegration(id, "admin");
        await processJobs("org-zoom-stop", 10);
        assert.ok((await listJobs()).every((job: { status: string }) => job.status === "cancelled" || job.status === "completed"));
        assert.equal((await listJobs()).some((job: { status: string }) => job.status === "cancelled"), true);
        const importedAfter = (await searchConversations(auth("org-zoom-stop"), { source: "zoom" })).total;
        await enqueueSync(id).catch(() => undefined);
        await processJobs("org-zoom-stop", 5);
        assert.equal((await searchConversations(auth("org-zoom-stop"), { source: "zoom" })).total, importedAfter);
        assert.equal((await (await import("../revenue/connections")).listConnections()).length, 0);
      });
    } finally {
      if (previousClef === undefined) delete process.env.CLEF_EVALUATION_MODE; else process.env.CLEF_EVALUATION_MODE = previousClef;
      if (previousBilling === undefined) delete process.env.BILLING_REQUIRED; else process.env.BILLING_REQUIRED = previousBilling;
    }
  });
});

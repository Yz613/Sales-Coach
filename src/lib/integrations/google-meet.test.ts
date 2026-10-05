import assert from "node:assert/strict";
import { after, test } from "node:test";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AuthUser } from "../auth";

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sales-google-meet-"));
process.env.SALES_COACH_DB_PATH = path.join(directory, "test.db");
process.env.INTEGRATION_ENCRYPTION_KEY = randomBytes(32).toString("base64");
process.env.CALL_AUDIO_DIR = path.join(directory, "audio");
process.env.PUBLIC_APP_URL = "https://coach.example.com";
const saved = {
  meetId: process.env.GOOGLE_MEET_CLIENT_ID,
  meetSecret: process.env.GOOGLE_MEET_CLIENT_SECRET,
  googleId: process.env.GOOGLE_CLIENT_ID,
  googleSecret: process.env.GOOGLE_CLIENT_SECRET,
  calendarId: process.env.GOOGLE_CALENDAR_CLIENT_ID,
  calendarSecret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
};
after(() => {
  const restore = (name: string, value: string | undefined) => { if (value === undefined) delete process.env[name]; else process.env[name] = value; };
  restore("GOOGLE_MEET_CLIENT_ID", saved.meetId);
  restore("GOOGLE_MEET_CLIENT_SECRET", saved.meetSecret);
  restore("GOOGLE_CLIENT_ID", saved.googleId);
  restore("GOOGLE_CLIENT_SECRET", saved.googleSecret);
  restore("GOOGLE_CALENDAR_CLIENT_ID", saved.calendarId);
  restore("GOOGLE_CALENDAR_CLIENT_SECRET", saved.calendarSecret);
  fs.rmSync(directory, { recursive: true, force: true });
});

const syncStart = "2026-10-05T12:00:00.000Z";
const recentEnd = new Date(Date.now() - 60_000).toISOString();
const MEET_SCOPES = "https://www.googleapis.com/auth/meetings.space.readonly https://www.googleapis.com/auth/drive.meet.readonly https://www.googleapis.com/auth/contacts.readonly https://www.googleapis.com/auth/userinfo.email";
const auth = (tenant: string): AuthUser => ({ userId: "manager", role: "admin", isAdmin: true, isMember: false, isClerkConfigured: false, canViewAllCalls: true, tenantId: tenant, clerkPlanId: null, billingPaid: true, name: "Manager", email: "alex@example.com" });

function conference(id: string, endTime: string, extra: Record<string, unknown> = {}) {
  return { name: `conferenceRecords/${id}`, startTime: "2026-10-01T14:00:00Z", endTime, space: "spaces/demo", ...extra };
}

let failList = false;
let mediaRedirect: "none" | "signed" | "evil" = "none";
const seen: { url: string; authorization: string }[] = [];

function meetFetch(input: RequestInfo | URL, init?: RequestInit): Response | Promise<Response> {
  const url = new URL(String(input));
  const authorization = String((init?.headers as Record<string, string> | undefined)?.Authorization || "");
  seen.push({ url: url.toString(), authorization });
  if (url.origin === "https://oauth2.googleapis.com") {
    return Response.json({ access_token: "meet-access", refresh_token: "meet-refresh", expires_in: 3600, token_type: "Bearer", scope: url.searchParams.get("scope-fixture") || MEET_SCOPES });
  }
  if (url.pathname === "/oauth2/v2/userinfo") return Response.json({ email: "alex@example.com", name: "Alex Rep" });
  if (url.hostname === "www.googleapis.com" && url.pathname.startsWith("/drive/v3/files/")) {
    if (authorization) assert.match(authorization, /^Bearer meet-(token|access)$/);
    const fileId = decodeURIComponent(url.pathname.split("/").pop() || "");
    if (url.searchParams.get("alt") === "media") {
      if (mediaRedirect === "evil") return new Response(null, { status: 302, headers: { location: "https://evil.example/steal" } });
      if (mediaRedirect === "signed") return new Response(null, { status: 302, headers: { location: "https://lh3.googleusercontent.com/meet-file" } });
      return new Response(Uint8Array.from([9, 8, 7, 6]), { status: 200, headers: { "content-type": "video/mp4" } });
    }
    if (fileId === "meetfilelarge1") return Response.json({ mimeType: "video/mp4", size: "50000000", webViewLink: "https://drive.google.com/file/d/meetfilelarge1/view?access_token=do-not-keep" });
    return Response.json({ mimeType: "video/mp4", size: "4", webViewLink: "https://drive.google.com/file/d/meetfilebudget1/view" });
  }
  if (url.hostname === "lh3.googleusercontent.com") {
    assert.equal(authorization, "");
    return new Response(Uint8Array.from([1, 2, 3, 4]), { status: 200, headers: { "content-type": "video/mp4" } });
  }
  if (url.hostname === "people.googleapis.com") {
    assert.match(authorization, /^Bearer meet-(token|access)$/);
    const id = decodeURIComponent(url.pathname.split("/").pop() || "");
    const email = id === "pat" ? "pat@acme.com" : id === "host" ? "alex@example.com" : "";
    return Response.json({ emailAddresses: email ? [{ value: email }] : [] });
  }
  if (url.hostname !== "meet.googleapis.com") return new Response("no", { status: 404 });
  if (authorization) assert.match(authorization, /^Bearer meet-(token|access)$/);
  if (url.pathname === "/v2/conferenceRecords") {
    if (failList) {
      return Response.json({
        error: { code: 403, message: "Google Meet API has not been used in project 999 before or it is disabled.", errors: [{ reason: "accessNotConfigured" }], status: "PERMISSION_DENIED" },
        access_token: "ya29.super-secret-token", refresh_token: "1//refresh-secret",
      }, { status: 403 });
    }
    const page = url.searchParams.get("pageToken");
    if (page === "page-2") {
      return Response.json({ conferenceRecords: [
        conference("conf-recent", recentEnd),
        conference("conf-expired", "2026-09-10T14:00:00Z", { startTime: "2026-09-10T13:00:00Z" }),
        conference("conf-large", "2026-09-20T15:00:00Z", { startTime: "2026-09-20T14:00:00Z" }),
      ] });
    }
    return Response.json({ conferenceRecords: [conference("conf-budget", "2026-10-01T14:30:00Z")], nextPageToken: "page-2" });
  }
  if (url.pathname.endsWith("/participants")) {
    const id = url.pathname.split("/")[3];
    if (id !== "conf-budget") return Response.json({ participants: [] });
    return Response.json({ participants: [
      { name: `conferenceRecords/${id}/participants/host`, signedinUser: { user: "users/host", displayName: "Alex Rep" } },
      { name: `conferenceRecords/${id}/participants/pat`, signedinUser: { user: "users/pat", displayName: "Pat Buyer" } },
    ] });
  }
  if (url.pathname.endsWith("/transcripts")) {
    const id = url.pathname.split("/")[3];
    if (id === "conf-recent") return Response.json({ transcripts: [{ name: `conferenceRecords/${id}/transcripts/t1`, state: "STARTED" }] });
    if (id === "conf-expired") return Response.json({ transcripts: [] });
    return Response.json({ transcripts: [{ name: `conferenceRecords/${id}/transcripts/t1`, state: "FILE_GENERATED" }] });
  }
  if (url.pathname.endsWith("/entries")) {
    const id = url.pathname.split("/")[3];
    if (id === "conf-expired" || id === "conf-recent") return Response.json({ transcriptEntries: [] });
    const start = id === "conf-large" ? "2026-09-20T14:00:01Z" : "2026-10-01T14:00:01Z";
    return Response.json({ transcriptEntries: [
      { participant: `conferenceRecords/${id}/participants/pat`, text: "What is your budget?", startTime: start, endTime: start.replace("01Z", "04Z") },
      { participant: `conferenceRecords/${id}/participants/host`, text: "We can review it this week.", startTime: start.replace("01Z", "05Z"), endTime: start.replace("01Z", "09Z") },
    ] });
  }
  if (url.pathname.endsWith("/recordings")) {
    const id = url.pathname.split("/")[3];
    if (id === "conf-expired" || id === "conf-recent") return Response.json({ recordings: [] });
    const file = id === "conf-large" ? "meetfilelarge1" : "meetfilebudget1";
    return Response.json({ recordings: [{ name: `conferenceRecords/${id}/recordings/r1`, state: "FILE_GENERATED", driveDestination: { file, exportUri: `https://drive.google.com/file/d/${file}/view` } }] });
  }
  return new Response("no", { status: 404 });
}

async function withMeet(fn: () => Promise<void>) {
  const original = global.fetch;
  global.fetch = meetFetch as typeof fetch;
  try { await fn(); } finally { global.fetch = original; }
}

async function drain(orgId: string) {
  const { processJobs } = await import("../revenue/jobs");
  for (let round = 0; round < 40; round++) if (!(await processJobs(orgId, 8)).length) return;
  assert.fail("Google Meet sync did not finish");
}

test("Meet file ids and downloads keep the bearer on googleapis.com", { concurrency: false }, async () => {
  const { driveFileId, googleMeetDownload } = await import("./google-meet");
  assert.equal(driveFileId("https://drive.google.com/file/d/abc_DEF-1234567890/view"), "abc_DEF-1234567890");
  assert.equal(driveFileId("files/abc_DEF-1234567890"), "abc_DEF-1234567890");
  assert.equal(driveFileId("short"), null);
  await withMeet(async () => {
    mediaRedirect = "signed";
    const savedBytes = await googleMeetDownload("meet-token", "https://www.googleapis.com/drive/v3/files/meetfilebudget1?alt=media", 1000);
    assert.equal(savedBytes.bytes.length, 4);
    assert.equal(seen.some(call => call.url.includes("googleusercontent.com") && call.authorization === ""), true);
    mediaRedirect = "evil";
    await assert.rejects(() => googleMeetDownload("meet-token", "https://www.googleapis.com/drive/v3/files/meetfilebudget1?alt=media", 1000), /invalid download/);
    mediaRedirect = "none";
  });
});

test("Google Meet imports conferences once, matches participant email, and coaches the call", { concurrency: false }, async () => {
  process.env.GOOGLE_MEET_CLIENT_ID = "meet-client";
  process.env.GOOGLE_MEET_CLIENT_SECRET = "meet-secret";
  const { runWithTenant } = await import("../tenant");
  const { connectIntegration } = await import("../revenue/connections");
  const { enqueueSync, processJobs } = await import("../revenue/jobs");
  const { importedCallId } = await import("../revenue/imports");
  const { getCallById } = await import("../db/service");
  const { searchConversations, conversationDetail, createTracker } = await import("../revenue/conversations");
  const { providerRecording } = await import("../revenue/recording");
  const { readCallAudio } = await import("../callAudioStore");
  const { saveScorecard, listCallScorecards } = await import("../scorecards");
  const { db } = await import("../db");
  const { crmRecords, evaluations } = await import("../db/schema");
  const { eq } = await import("drizzle-orm");
  const secrets = { token: "meet-token", authType: "oauth", refreshToken: "refresh", expiresAt: String(Date.now() + 3600000) };
  await withMeet(async () => {
    failList = false;
    seen.length = 0;
    await runWithTenant("org-meet", async () => {
      await db.insert(crmRecords).values({ id: "contact-pat", orgId: "org-meet", connectionId: "crm-meet", provider: "hubspot", externalId: "124", kind: "contact", name: "Pat Buyer", email: "pat@acme.com", syncedAt: "2026-10-01T00:00:00.000Z" }).run();
      await saveScorecard("manager", { name: "Meet discovery", visibility: "managers", autoApply: true, filters: { sources: ["google-meet"] }, questions: [{ prompt: "Asked about budget?", scale: "pass_fail" }] });
      await createTracker({ name: "Budget", keywords: "budget" }, "manager");
      const id = await connectIntegration({ provider: "google-meet", autoEvaluate: true, autoSync: true }, "manager", secrets);
      await enqueueSync(id);
      const queued = await processJobs("org-meet", 1);
      assert.equal(queued[0].status, "completed");
      const listCall = seen.map(call => new URL(call.url)).find(url => {
        const filter = url.searchParams.get("filter") || "";
        const start = Date.parse((filter.match(/start_time>="([^"]+)"/) || [])[1] || "");
        const end = Date.parse((filter.match(/end_time<="([^"]+)"/) || [])[1] || "");
        return Number.isFinite(start) && Number.isFinite(end) && end - start >= 29 * 86400000 && end - start <= 30 * 86400000 + 5000;
      });
      assert.ok(listCall);
      await drain("org-meet");
      const callId = importedCallId("org-meet", id, "conf-budget");
      const call = await getCallById(callId);
      assert.ok(call);
      assert.match(call.transcriptText, /Pat Buyer: What is your budget\?/);
      assert.match(call.transcriptText, /0:01/);
      const detail = await conversationDetail(call);
      assert.equal(detail.source, "google-meet");
      assert.equal(detail.title, "Google Meet · Pat Buyer");
      assert.equal(detail.participants.some((person: { email?: string }) => person.email === "pat@acme.com"), true);
      assert.equal(detail.linked.some((record: { id: string }) => record.id === "contact-pat"), true);
      assert.equal(detail.trackers.some((tracker: { name: string }) => tracker.name === "Budget"), true);
      assert.ok(call.audioUrl);
      const audio = await readCallAudio(callId);
      assert.equal(audio?.bytes.length, 4);
      const cards = await listCallScorecards(auth("org-meet"), callId);
      assert.equal(cards.applications.some((item: { templateName: string }) => item.templateName === "Meet discovery"), true);
      const evaluated = await db.select().from(evaluations).where(eq(evaluations.callId, callId)).all();
      assert.ok(evaluated.length > 0);
      assert.equal(await getCallById(importedCallId("org-meet", id, "conf-recent")), null);
      const expired = await getCallById(importedCallId("org-meet", id, "conf-expired"));
      assert.ok(expired);
      assert.match(expired.transcriptText, /not available from Google Meet/);
      const largeId = importedCallId("org-meet", id, "conf-large");
      assert.equal((await getCallById(largeId))?.audioUrl ?? null, null);
      const playback = await providerRecording(largeId);
      assert.equal(playback.status, "completed");
      assert.equal(playback.url, "https://drive.google.com/file/d/meetfilelarge1/view");
      assert.equal(String(playback.url).includes("meet-token"), false);
      assert.equal(String(playback.url).includes("access_token"), false);
      const before = (await searchConversations(auth("org-meet"), { source: "google-meet" })).total;
      await enqueueSync(id, true);
      await drain("org-meet");
      assert.equal((await searchConversations(auth("org-meet"), { source: "google-meet" })).total, before);
    });
    await runWithTenant("org-meet-other", async () => {
      assert.equal(await getCallById(importedCallId("org-meet", "missing", "conf-budget")), null);
      assert.equal((await searchConversations(auth("org-meet-other"), { source: "google-meet" })).total, 0);
    });
  });
});

test("Meet sign-in falls back through Gmail and Calendar clients and reports a disabled API without tokens", { concurrency: false }, async () => {
  const { startOAuth, OAUTH_COOKIE } = await import("./oauth");
  const { runWithTenant } = await import("../tenant");
  const { runWithAuth } = await import("../auth");
  delete process.env.GOOGLE_MEET_CLIENT_ID;
  delete process.env.GOOGLE_MEET_CLIENT_SECRET;
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.GOOGLE_CALENDAR_CLIENT_ID;
  delete process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  await assert.rejects(() => runWithTenant("local", () => startOAuth("google-meet", "manager", { name: "Google Meet" }, "https://coach.example.com")), (error: { status?: number }) => error.status === 503);

  process.env.GOOGLE_CLIENT_ID = "gmail-web-client";
  process.env.GOOGLE_CLIENT_SECRET = "gmail-web-secret";
  const gmailClient = await runWithTenant("local", () => startOAuth("google-meet", "manager", { name: "Google Meet" }, "https://coach.example.com"));
  assert.equal(new URL(gmailClient.url).searchParams.get("client_id"), "gmail-web-client");
  assert.match(new URL(gmailClient.url).searchParams.get("scope") || "", /meetings\.space\.readonly/);
  assert.equal(new URL(gmailClient.url).searchParams.get("access_type"), "offline");

  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  process.env.GOOGLE_CALENDAR_CLIENT_ID = "calendar-client";
  process.env.GOOGLE_CALENDAR_CLIENT_SECRET = "calendar-secret";
  const calendarClient = await runWithTenant("local", () => startOAuth("google-meet", "manager", { name: "Google Meet" }, "https://coach.example.com"));
  assert.equal(new URL(calendarClient.url).searchParams.get("client_id"), "calendar-client");

  const logged: unknown[][] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => { logged.push(args); };
  await withMeet(async () => {
    failList = true;
    const { GET } = await import("../../app/api/integrations/oauth/[provider]/callback/route");
    const callback = (state: string) => runWithAuth(auth("local"), () => GET(new Request(`http://127.0.0.1/app/api/integrations/oauth/google-meet/callback?code=one-use-code&state=${state}`, {
      headers: { cookie: `${OAUTH_COOKIE}=${state}` },
    }), { params: Promise.resolve({ provider: "google-meet" }) }));
    const failed = await callback(calendarClient.state);
    const location = new URL(failed.headers.get("location") || "");
    assert.equal(location.pathname, "/app/admin/integrations/google-meet");
    assert.match(location.searchParams.get("connectionError") || "", /Google Meet API is not enabled/);
    const diagnostic = logged.find(entry => String(entry[0]).includes("Google Meet request failed"));
    assert.ok(diagnostic);
    assert.equal(diagnostic?.[1], 403);
    const body = JSON.stringify(diagnostic);
    assert.match(body, /accessNotConfigured|not been used/);
    assert.equal(body.includes("ya29.super-secret-token"), false);
    assert.equal(body.includes("1//refresh-secret"), false);

    failList = false;
    const denied = await runWithTenant("local", () => startOAuth("google-meet", "manager", { name: "Google Meet" }, "https://coach.example.com"));
    const original = global.fetch;
    global.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.origin === "https://oauth2.googleapis.com") {
        return Response.json({ access_token: "meet-access", refresh_token: "meet-refresh", expires_in: 3600, token_type: "Bearer", scope: "https://www.googleapis.com/auth/calendar.readonly" });
      }
      return new Response("should-not-run", { status: 500 });
    }) as typeof fetch;
    const missing = await callback(denied.state);
    assert.match(new URL(missing.headers.get("location") || "").searchParams.get("connectionError") || "", /did not grant Google Meet/);
    global.fetch = original;
  });
  console.error = originalError;
  failList = false;
});

import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AuthUser } from "../auth";

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sales-teams-"));
process.env.SALES_COACH_DB_PATH = path.join(directory, "test.db");
process.env.INTEGRATION_ENCRYPTION_KEY = randomBytes(32).toString("base64");
process.env.CALL_AUDIO_DIR = path.join(directory, "audio");
process.env.PUBLIC_APP_URL = "https://coach.example.com";
process.env.MICROSOFT_TEAMS_CLIENT_ID = "teams-client";
process.env.MICROSOFT_TEAMS_CLIENT_SECRET = "teams-secret";
after(() => fs.rmSync(directory, { recursive: true, force: true }));

const DAY = 86400000;
const USER = "11111111-1111-1111-1111-111111111111";
const syncStart = "2026-10-05T12:00:00.000Z";
const vtt = "WEBVTT\n\n1\n00:00:01.000 --> 00:00:04.000\nAlex Rep: What is your budget?\n\n2\n00:00:04.200 --> 00:00:08.000\n<v Pat Buyer>We need this next quarter.</v>\n";
const secrets = { token: "teams-token", authType: "oauth", refreshToken: "refresh", expiresAt: String(Date.now() + 3600000) };
type Mode = "calendar" | "delta" | "both" | "forbidden";
let mode: Mode = "calendar";
let personal = false;
let requests: { url: URL; authorization?: string }[] = [];
let logged: unknown[][] = [];

function event(id: string, extra: Record<string, unknown> = {}) {
  return {
    id: `evt-${id}`, subject: id === "follow" ? "Follow-up" : id === "huge" ? "Huge recording" : "Discovery",
    start: { dateTime: "2026-10-01T14:00:00.0000000", timeZone: "UTC" },
    end: { dateTime: "2026-10-01T14:30:00.0000000", timeZone: "UTC" },
    isAllDay: false, isOnlineMeeting: true, isOrganizer: true,
    onlineMeeting: { joinUrl: `https://teams.microsoft.com/l/meetup-join/${id}` },
    organizer: { emailAddress: { address: "alex@contoso.com", name: "Alex Rep" } },
    attendees: [
      { emailAddress: { address: "alex@contoso.com", name: "Alex Rep" } },
      { emailAddress: { address: "pat@acme.com", name: "Pat Buyer" } },
    ],
    ...extra,
  };
}

const joins: Record<string, string> = {
  "https://teams.microsoft.com/l/meetup-join/discovery": "meeting-discovery",
  "https://teams.microsoft.com/l/meetup-join/silent": "meeting-silent",
  "https://teams.microsoft.com/l/meetup-join/huge": "meeting-huge",
  "https://teams.microsoft.com/l/meetup-join/follow": "meeting-follow",
  "https://teams.microsoft.com/l/meetup-join/denied": "meeting-denied",
};

function calendarPage(url: URL) {
  if (url.searchParams.get("$top") === "1") return { value: [] };
  if (url.searchParams.get("$skiptoken") === "page-2") return { value: [event("follow")] };
  if (mode === "forbidden") return { value: [event("denied", { subject: "Denied" })] };
  return {
    value: [
      event("discovery"),
      event("all-day", { isAllDay: true, subject: "All day" }),
      event("guest", { isOrganizer: false, subject: "Guest", organizer: { emailAddress: { address: "other@elsewhere.com", name: "Other" } } }),
      event("plain", { onlineMeeting: null, subject: "No link" }),
      event("zoomish", { onlineMeeting: { joinUrl: "https://zoom.us/j/123" }, subject: "Zoom" }),
      event("offline", { isOnlineMeeting: false, subject: "Offline" }),
      event("silent", { subject: "No transcript" }),
      event("huge"),
    ],
    "@odata.nextLink": "https://graph.microsoft.com/v1.0/me/calendarView?$skiptoken=page-2",
  };
}

function deltaDenied() {
  return Response.json({
    error: { code: "Forbidden", message: "Delegated access is not supported." },
    access_token: "delta-secret-token",
    authorization: "Bearer delta-secret-token",
  }, { status: 403 });
}

function transcriptDenied() {
  return Response.json({
    error: { code: "Authorization_RequestDenied", message: "Need admin approval for OnlineMeetingTranscript.Read.All" },
    access_token: "transcript-secret-token",
    authorization: "Bearer transcript-secret-token",
  }, { status: 403 });
}

function teamsFetch(input: RequestInfo | URL, init?: RequestInit): Response | Promise<Response> {
  const url = new URL(String(input));
  const authorization = (init?.headers as Record<string, string> | undefined)?.Authorization;
  requests.push({ url, authorization });
  assert.equal(init?.redirect, "manual");
  if (url.hostname === "files.example.com") {
    assert.equal(authorization, undefined);
    return new Response(Uint8Array.from([1, 2, 3, 4]), { headers: { "content-type": "video/mp4", "content-length": "4" } });
  }
  if (url.hostname !== "graph.microsoft.com") return new Response("no", { status: 404 });
  if (authorization) assert.equal(authorization, "Bearer teams-token");
  if (url.pathname === "/v1.0/me") {
    if (personal) return Response.json({ id: USER, displayName: "Alex Personal", mail: "alex@outlook.com", userPrincipalName: "alex@outlook.com" });
    return Response.json({ id: USER, displayName: "Alex Rep", mail: "alex@contoso.com", userPrincipalName: "alex@contoso.com" });
  }
  if (url.pathname.includes("getAllRecordings")) {
    if (mode === "both") return Response.json({ value: [{ id: "rec-extra", meetingId: "meeting-extra" }] });
    return deltaDenied();
  }
  if (url.pathname.includes("getAllTranscripts")) {
    if (mode === "delta" || mode === "both") return Response.json({ value: [{ id: "tr-delta", meetingId: "meeting-delta", createdDateTime: "2026-10-01T14:00:00Z" }] });
    return deltaDenied();
  }
  if (url.pathname === "/v1.0/me/calendarView") return Response.json(calendarPage(url));
  if (url.pathname === "/v1.0/me/onlineMeetings") {
    const filter = url.searchParams.get("$filter") || "";
    const join = filter.match(/JoinWebUrl eq '([^']+)'/)?.[1] || "";
    const id = joins[join];
    if (!id) return Response.json({ value: [] });
    return Response.json({ value: [{ id, joinWebUrl: join }] });
  }
  const marker = "/v1.0/me/onlineMeetings/";
  if (!url.pathname.startsWith(marker)) return new Response("missing", { status: 404 });
  const rest = url.pathname.slice(marker.length).split("/");
  const id = decodeURIComponent(rest[0] || "");
  if (rest[1] === "transcripts" && rest[3] === "content") return new Response(vtt, { headers: { "content-type": "text/vtt" } });
  if (rest[1] === "transcripts") {
    if (id === "meeting-silent") return Response.json({ value: [] });
    if (id === "meeting-denied") return transcriptDenied();
    return Response.json({ value: [{ id: `tr-${id}`, createdDateTime: "2026-10-01T14:05:00Z" }] });
  }
  if (rest[1] === "recordings" && rest[3] === "content") {
    if (url.pathname.includes("/recordings/private/")) return new Response(null, { status: 302, headers: { location: "http://127.0.0.1/secret" } });
    if (id === "meeting-huge") return new Response("too-big", { headers: { "content-type": "video/mp4", "content-length": String(20 * 1024 * 1024 + 1) } });
    return new Response(null, { status: 302, headers: { location: `https://files.example.com/rec-${id}` } });
  }
  if (rest[1] === "recordings") return Response.json({ value: [{ id: `rec-${id}`, createdDateTime: "2026-10-01T15:00:00Z" }] });
  return Response.json({
    id, subject: id === "meeting-delta" ? "Delta discovery" : "Microsoft Teams meeting",
    startDateTime: "2026-10-01T14:00:00Z", endDateTime: "2026-10-01T14:30:00Z",
    joinWebUrl: "https://teams.microsoft.com/l/meetup-join/delta",
    participants: {
      organizer: { upn: "alex@contoso.com", identity: { user: { displayName: "Alex Rep" } } },
      attendees: [{ upn: "pat@acme.com", identity: { user: { displayName: "Pat Buyer" } } }],
    },
  });
}

async function withTeams(fn: () => Promise<void>) {
  const original = global.fetch;
  const originalError = console.error;
  global.fetch = teamsFetch as typeof fetch;
  console.error = (...args: unknown[]) => { logged.push(args); };
  try { await fn(); } finally {
    global.fetch = original;
    console.error = originalError;
    requests = [];
    logged = [];
    mode = "calendar";
    personal = false;
  }
}

async function drain(orgId: string) {
  const { processJobs } = await import("../revenue/jobs");
  for (let round = 0; round < 40; round++) if (!(await processJobs(orgId, 8)).length) return;
  assert.fail("Teams sync did not finish");
}

const auth = (tenant: string): AuthUser => ({ userId: "admin", role: "admin", isAdmin: true, isMember: false, isClerkConfigured: false, canViewAllCalls: true, tenantId: tenant, clerkPlanId: null, billingPaid: true, name: "Manager" });
const localAdmin: AuthUser = { ...auth("local"), userId: "admin" };

test("Teams calendar fallback keeps organizer meetings, VTT cues, and a 30-day window", async () => {
  const { teamsPage, teamsDownload, teamsPathId } = await import("./teams");
  const { integrationTool, isCallTool } = await import("./catalog");
  const { SCORECARD_SOURCES } = await import("../scorecardModel");
  assert.equal(integrationTool("microsoft-teams")?.syncMinutes, 15);
  assert.equal(isCallTool("microsoft-teams"), true);
  assert.ok(SCORECARD_SOURCES.some(source => source.id === "microsoft-teams" && source.label === "Microsoft Teams"));
  assert.equal(teamsPathId("meet/ing+a="), encodeURIComponent(encodeURIComponent("meet/ing+a=")));
  await withTeams(async () => {
    const first = await teamsPage(secrets, { syncStartedAt: syncStart });
    const view = requests.find(request => request.url.pathname === "/v1.0/me/calendarView" && request.url.searchParams.get("$top") === "20");
    assert.ok(view);
    assert.equal(view.url.searchParams.get("endDateTime"), syncStart);
    assert.equal(view.url.searchParams.get("startDateTime"), new Date(Date.parse(syncStart) - 30 * DAY).toISOString());
    const filters = requests.filter(request => (request.url.searchParams.get("$filter") || "").includes("JoinWebUrl")).map(request => request.url.searchParams.get("$filter") || "");
    assert.deepEqual(filters.map(filter => filter.match(/meetup-join\/([^']+)/)?.[1]).sort(), ["discovery", "huge", "silent"]);
    assert.equal(filters.some(filter => filter.includes("zoom.us")), false);
    assert.equal(first.next.teamsDiscovery, "calendar");
    assert.equal(first.next.teamsRecordings, "no");
    assert.equal(first.next.complete, false);
    assert.match(first.next.after || "", /\$skiptoken=page-2/);
    assert.deepEqual(first.deferred.map(item => item.id).sort(), ["meeting-discovery", "meeting-huge", "meeting-silent"]);
    const second = await teamsPage(secrets, first.next);
    assert.deepEqual(second.deferred.map(item => item.id), ["meeting-follow"]);
    assert.equal(second.next.complete, true);
    const probeLogs = logged.filter(entry => String(entry[0]).includes("Microsoft Teams request failed") && entry[1] === 403);
    assert.ok(probeLogs.length >= 1);
    assert.equal(JSON.stringify(probeLogs).includes("delta-secret-token"), false);
    requests = [];
    await teamsPage(secrets, { syncStartedAt: syncStart, teamsDiscovery: "calendar", teamsRecordings: "no", teamsUserId: USER, hostEmail: "alex@contoso.com", hostName: "Alex Rep" });
    assert.equal(requests.some(request => request.url.pathname.includes("getAll")), false);
    await assert.rejects(() => teamsPage(secrets, { syncStartedAt: syncStart, teamsDiscovery: "calendar", teamsRecordings: "no", teamsUserId: USER, hostEmail: "alex@contoso.com", hostName: "Alex Rep", after: "https://evil.example/v1.0/me/calendarView" }), /invalid page/);
    await assert.rejects(() => teamsDownload("teams-token", "https://graph.microsoft.com/v1.0/me/onlineMeetings/x/recordings/private/content", 1000, "video/mp4"), /invalid download/);
    mode = "both";
    requests = [];
    const merged = await teamsPage(secrets, { syncStartedAt: syncStart, teamsUserId: USER, hostEmail: "alex@contoso.com", hostName: "Alex Rep" });
    assert.equal(merged.next.teamsDiscovery, "delta");
    assert.equal(merged.next.teamsRecordings, "yes");
    assert.deepEqual(merged.deferred.map(item => item.id).sort(), ["meeting-delta", "meeting-extra"]);
    assert.equal(requests.some(request => request.url.pathname === "/v1.0/me/calendarView"), false);
  });
});

test("Teams imports organizer calls once, stores a short recording, and matches the deal", async () => {
  const { runWithTenant } = await import("../tenant");
  const { connectIntegration, disconnectIntegration, getConnection, listConnections } = await import("../revenue/connections");
  const { enqueueSync, processJobs, listJobs } = await import("../revenue/jobs");
  const { importedCallId } = await import("../revenue/imports");
  const { getCallById } = await import("../db/service");
  const { searchConversations, conversationDetail } = await import("../revenue/conversations");
  const { readCallAudio } = await import("../callAudioStore");
  const { crmOverview } = await import("../revenue/crm");
  const { db } = await import("../db");
  const { crmRecords, evaluations, processingJobs } = await import("../db/schema");
  const { and, eq } = await import("drizzle-orm");
  const releaseSync = (orgId: string) => db.delete(processingJobs).where(and(eq(processingJobs.orgId, orgId), eq(processingJobs.kind, "sync"))).run();
  await withTeams(async () => {
    personal = true;
    await runWithTenant("org-teams-personal", async () => {
      await assert.rejects(() => connectIntegration({ provider: "microsoft-teams" }, "admin"), /sign-in button/);
      await assert.rejects(() => connectIntegration({ provider: "microsoft-teams" }, "admin", secrets), /work or school/);
      assert.equal((await listConnections()).length, 0);
    });
    personal = false;
    const previousClef = process.env.CLEF_EVALUATION_MODE;
    const previousBilling = process.env.BILLING_REQUIRED;
    process.env.CLEF_EVALUATION_MODE = "off";
    process.env.BILLING_REQUIRED = "false";
    try {
      let callId = "";
      await runWithTenant("org-teams-a", async () => {
        await db.insert(crmRecords).values([
          { id: "contact-pat", orgId: "org-teams-a", connectionId: "crm", provider: "hubspot", externalId: "p1", kind: "contact", name: "Pat", email: "pat@acme.com", syncedAt: syncStart },
          { id: "deal-acme", orgId: "org-teams-a", connectionId: "crm", provider: "hubspot", externalId: "d1", kind: "deal", name: "Acme expansion", associations: JSON.stringify(["contact-pat"]), syncedAt: syncStart },
        ]).run();
        const id = await connectIntegration({ provider: "microsoft-teams", autoEvaluate: true, autoSync: true }, "admin", secrets);
        assert.equal((await getConnection(id)).config.accountEmail, "alex@contoso.com");
        await enqueueSync(id);
        await drain("org-teams-a");
        const cursor = (await getConnection(id)).cursor;
        assert.equal(cursor.teamsDiscovery, "calendar");
        assert.equal(cursor.teamsRecordings, "no");
        callId = importedCallId("org-teams-a", id, "meeting-discovery");
        const call = await getCallById(callId);
        assert.ok(call);
        const detail = await conversationDetail(call);
        assert.equal(detail.source, "microsoft-teams");
        assert.equal(detail.title, "Discovery");
        assert.equal(detail.segments[0].start, 1);
        assert.equal(detail.segments[1].speaker, "Pat Buyer");
        assert.equal(detail.segments[1].text, "We need this next quarter.");
        assert.equal(detail.participants.find((person: { email?: string }) => person.email === "pat@acme.com")?.external, true);
        assert.equal(detail.recordingPageUrl?.includes("teams.microsoft.com"), true);
        assert.equal(await getCallById(importedCallId("org-teams-a", id, "meeting-silent")), null);
        const stored = await readCallAudio(callId);
        assert.deepEqual([...(stored?.bytes || [])], [1, 2, 3, 4]);
        assert.equal((await getCallById(importedCallId("org-teams-a", id, "meeting-huge")))?.audioUrl, undefined);
        assert.ok(await getCallById(importedCallId("org-teams-a", id, "meeting-follow")));
        assert.equal((await searchConversations(auth("org-teams-a"), { source: "microsoft-teams" })).total, 3);
        const overview = await crmOverview();
        assert.ok(overview.deals.find(deal => deal.id === "deal-acme")?.linkedCalls.some(linked => linked.id === callId));
        assert.equal((await db.select().from(evaluations).where(eq(evaluations.callId, callId)).all()).length, 1);
        const payloads = (await db.select().from(processingJobs).where(eq(processingJobs.orgId, "org-teams-a")).all()).map((job: { payload: string }) => job.payload).join("\n");
        assert.equal(payloads.includes("delta-secret-token"), false);
        assert.equal(payloads.includes("teams-token"), false);
        const firstSynced = (await getConnection(id)).lastSyncedAt || "";
        requests = [];
        logged = [];
        await releaseSync("org-teams-a");
        await enqueueSync(id);
        await drain("org-teams-a");
        assert.equal(requests.some(request => request.url.pathname.includes("getAll")), false);
        const incremental = requests.find(request => request.url.pathname === "/v1.0/me/calendarView" && request.url.searchParams.get("$top") === "20");
        assert.equal(incremental?.url.searchParams.get("startDateTime"), new Date(Date.parse(firstSynced) - DAY).toISOString());
        assert.equal((await searchConversations(auth("org-teams-a"), { source: "microsoft-teams" })).total, 3);
        requests = [];
        await releaseSync("org-teams-a");
        await enqueueSync(id, true);
        await drain("org-teams-a");
        const history = requests.find(request => request.url.pathname === "/v1.0/me/calendarView" && request.url.searchParams.get("$top") === "20");
        const historyStart = Date.parse(history?.url.searchParams.get("startDateTime") || "");
        const historyEnd = Date.parse(history?.url.searchParams.get("endDateTime") || "");
        assert.equal(historyEnd - historyStart, 30 * DAY);
        assert.equal((await searchConversations(auth("org-teams-a"), { source: "microsoft-teams" })).total, 3);
        assert.equal((await getConnection(id)).status, "connected");
      });
      await runWithTenant("org-teams-b", async () => {
        const id = await connectIntegration({ provider: "microsoft-teams", autoEvaluate: false }, "admin", secrets);
        await enqueueSync(id);
        await drain("org-teams-b");
        assert.ok(await getCallById(importedCallId("org-teams-b", id, "meeting-discovery")));
        assert.equal(await getCallById(callId), null);
        assert.equal((await searchConversations(auth("org-teams-b"), { source: "microsoft-teams" })).total, 3);
      });
      await runWithTenant("org-teams-stop", async () => {
        const id = await connectIntegration({ provider: "microsoft-teams", autoSync: true }, "admin", secrets);
        await enqueueSync(id);
        await processJobs("org-teams-stop", 1);
        await disconnectIntegration(id, "admin");
        await processJobs("org-teams-stop", 10);
        assert.ok((await listJobs()).some((job: { status: string }) => job.status === "cancelled"));
        const importedAfter = (await searchConversations(auth("org-teams-stop"), { source: "microsoft-teams" })).total;
        await enqueueSync(id).catch(() => undefined);
        await processJobs("org-teams-stop", 5);
        assert.equal((await searchConversations(auth("org-teams-stop"), { source: "microsoft-teams" })).total, importedAfter);
        const disconnected = await listConnections();
        assert.equal(disconnected.length, 1);
        assert.equal(disconnected[0].status, "disconnected");
        assert.equal(disconnected[0].config.revocationPending, true);
      });
      mode = "forbidden";
      logged = [];
      await runWithTenant("org-teams-deny", async () => {
        const id = await connectIntegration({ provider: "microsoft-teams", autoEvaluate: false }, "admin", secrets);
        await enqueueSync(id);
        await drain("org-teams-deny");
        const connection = await getConnection(id);
        assert.match(connection.lastError || "", /Need admin approval for OnlineMeetingTranscript\.Read\.All/);
        assert.equal(await getCallById(importedCallId("org-teams-deny", id, "meeting-denied")), null);
      });
      const deniedLog = JSON.stringify(logged);
      assert.equal(deniedLog.includes("transcript-secret-token"), false);
      assert.match(deniedLog, /403/);
      mode = "delta";
      await runWithTenant("org-teams-delta", async () => {
        const id = await connectIntegration({ provider: "microsoft-teams", autoEvaluate: false }, "admin", secrets);
        requests = [];
        await enqueueSync(id);
        await drain("org-teams-delta");
        assert.equal(requests.some(request => request.url.pathname === "/v1.0/me/calendarView" && request.url.searchParams.get("$top") === "20"), false);
        assert.equal(requests.some(request => request.url.pathname.includes("getAllTranscripts")), true);
        const call = await getCallById(importedCallId("org-teams-delta", id, "meeting-delta"));
        assert.ok(call);
        const detail = await conversationDetail(call);
        assert.equal(detail.title, "Delta discovery");
        assert.equal(detail.participants.find((person: { email?: string }) => person.email === "pat@acme.com")?.external, true);
        assert.equal((await getConnection(id)).cursor.teamsDiscovery, "delta");
        assert.equal((await getConnection(id)).cursor.teamsRecordings, "no");
        requests = [];
        await releaseSync("org-teams-delta");
        await enqueueSync(id);
        await drain("org-teams-delta");
        assert.equal(requests.some(request => request.url.pathname.includes("getAllRecordings")), false);
        assert.equal(requests.some(request => request.url.pathname.includes("getAllTranscripts")), true);
        assert.equal((await searchConversations(auth("org-teams-delta"), { source: "microsoft-teams" })).total, 1);
      });
    } finally {
      if (previousClef === undefined) delete process.env.CLEF_EVALUATION_MODE;
      else process.env.CLEF_EVALUATION_MODE = previousClef;
      if (previousBilling === undefined) delete process.env.BILLING_REQUIRED;
      else process.env.BILLING_REQUIRED = previousBilling;
    }
  });
});

test("Teams sign-in uses the common endpoint, falls back to the Outlook app, and shows admin-consent failures", async () => {
  const { startOAuth, finishOAuth, oauthAvailability, OAUTH_COOKIE } = await import("./oauth");
  const { runWithTenant } = await import("../tenant");
  const { runWithAuth } = await import("../auth");
  const savedTeams = process.env.MICROSOFT_TEAMS_CLIENT_ID;
  const savedTeamsSecret = process.env.MICROSOFT_TEAMS_CLIENT_SECRET;
  const savedMicrosoft = process.env.MICROSOFT_CLIENT_ID;
  const savedMicrosoftSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const original = global.fetch;
  const originalError = console.error;
  const notes: unknown[][] = [];
  console.error = (...args: unknown[]) => { notes.push(args); };
  try {
    delete process.env.MICROSOFT_TEAMS_CLIENT_ID;
    delete process.env.MICROSOFT_TEAMS_CLIENT_SECRET;
    delete process.env.MICROSOFT_CLIENT_ID;
    delete process.env.MICROSOFT_CLIENT_SECRET;
    assert.equal(oauthAvailability()["microsoft-teams"], false);
    await assert.rejects(() => runWithTenant("local", () => startOAuth("microsoft-teams", "admin", {}, "https://coach.example.com")), /sign-in credentials/);
    process.env.MICROSOFT_CLIENT_ID = "mail-client";
    process.env.MICROSOFT_CLIENT_SECRET = "mail-secret";
    assert.equal(oauthAvailability()["microsoft-teams"], true);
    const fallback = await runWithTenant("local", () => startOAuth("microsoft-teams", "admin", { name: "Teams" }, "https://coach.example.com"));
    const fallbackUrl = new URL(fallback.url);
    assert.equal(fallbackUrl.origin + fallbackUrl.pathname, "https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
    assert.equal(fallbackUrl.pathname.includes("organizations"), false);
    assert.equal(fallbackUrl.searchParams.get("client_id"), "mail-client");
    assert.equal(fallbackUrl.searchParams.get("code_challenge_method"), "S256");
    assert.equal(fallbackUrl.searchParams.get("redirect_uri"), "https://coach.example.com/app/api/integrations/oauth/microsoft-teams/callback");
    const scope = fallbackUrl.searchParams.get("scope") || "";
    for (const item of ["offline_access", "User.Read", "Calendars.Read", "OnlineMeetings.Read", "OnlineMeetingTranscript.Read.All", "OnlineMeetingRecording.Read.All"]) assert.ok(scope.split(" ").includes(item), item);
    assert.equal(scope.includes("ReadWrite"), false);
    assert.equal(scope.includes("Chat.Read"), false);
    process.env.MICROSOFT_TEAMS_CLIENT_ID = "teams-client";
    process.env.MICROSOFT_TEAMS_CLIENT_SECRET = "teams-secret";
    const preferred = await runWithTenant("local", () => startOAuth("microsoft-teams", "admin", { name: "Teams" }, "https://coach.example.com"));
    assert.equal(new URL(preferred.url).searchParams.get("client_id"), "teams-client");

    global.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const params = Object.fromEntries(new URLSearchParams(String(init?.body)));
      assert.equal(params.client_id, "teams-client");
      assert.equal(params.client_secret, "teams-secret");
      const granted = new URL(String(_input)).searchParams.get("scope-fixture") || "User.Read Calendars.Read OnlineMeetings.Read";
      return Response.json({ access_token: "account-token", refresh_token: "refresh-token", expires_in: 3600, token_type: "Bearer", scope: granted });
    }) as typeof fetch;
    await assert.rejects(() => runWithTenant("local", () => finishOAuth("microsoft-teams", "admin", preferred.state, preferred.state, "one-use-code")), /did not grant Teams/);
    const allowed = await runWithTenant("local", () => startOAuth("microsoft-teams", "admin", { name: "Teams" }, "https://coach.example.com"));
    global.fetch = (async () => Response.json({
      access_token: "account-token", refresh_token: "refresh-token", expires_in: 3600, token_type: "Bearer",
      scope: "User.Read Calendars.Read OnlineMeetings.Read OnlineMeetingTranscript.Read.All OnlineMeetingRecording.Read.All",
    })) as typeof fetch;
    const finished = await runWithTenant("local", () => finishOAuth("microsoft-teams", "admin", allowed.state, allowed.state, "one-use-code"));
    assert.equal(finished.secrets.token, "account-token");

    const denied = await runWithTenant("local", () => startOAuth("microsoft-teams", "admin", { name: "Teams" }, "https://coach.example.com"));
    global.fetch = (async () => Response.json({
      error: "invalid_grant",
      error_description: "AADSTS65001: Need admin approval for OnlineMeetingTranscript.Read.All",
      access_token: "super-secret-token",
    }, { status: 400 })) as typeof fetch;
    const { GET } = await import("../../app/api/integrations/oauth/[provider]/callback/route");
    const callback = (state: string, query = `code=one-use-code&state=${state}`) => runWithAuth(localAdmin, () => GET(new Request(`http://127.0.0.1/app/api/integrations/oauth/microsoft-teams/callback?${query}`, {
      headers: { cookie: `${OAUTH_COOKIE}=${state}` },
    }), { params: Promise.resolve({ provider: "microsoft-teams" }) }));
    const failed = await callback(denied.state);
    const failedLocation = new URL(failed.headers.get("location") || "");
    assert.match(failedLocation.searchParams.get("connectionError") || "", /Need admin approval for OnlineMeetingTranscript\.Read\.All/);
    assert.equal((failedLocation.searchParams.get("connectionError") || "").includes("super-secret-token"), false);
    const tokenLog = notes.find(entry => String(entry[0]).includes("Microsoft request failed"));
    assert.equal(tokenLog?.[1], 400);
    assert.equal(JSON.stringify(tokenLog).includes("super-secret-token"), false);

    const cancelled = await runWithTenant("local", () => startOAuth("microsoft-teams", "admin", { name: "Teams" }, "https://coach.example.com"));
    const declined = await callback(cancelled.state, `error=access_denied&error_description=${encodeURIComponent("AADSTS65001: Need admin approval for OnlineMeetingRecording.Read.All Bearer super-secret-token")}&state=${cancelled.state}`);
    const declinedLocation = new URL(declined.headers.get("location") || "");
    assert.match(declinedLocation.searchParams.get("connectionError") || "", /administrator must grant consent|Need admin approval/);
    assert.equal((declinedLocation.searchParams.get("connectionError") || "").includes("super-secret-token"), false);
    assert.equal(JSON.stringify(notes).includes("super-secret-token"), false);
  } finally {
    global.fetch = original;
    console.error = originalError;
    if (savedTeams === undefined) delete process.env.MICROSOFT_TEAMS_CLIENT_ID;
    else process.env.MICROSOFT_TEAMS_CLIENT_ID = savedTeams;
    if (savedTeamsSecret === undefined) delete process.env.MICROSOFT_TEAMS_CLIENT_SECRET;
    else process.env.MICROSOFT_TEAMS_CLIENT_SECRET = savedTeamsSecret;
    if (savedMicrosoft === undefined) delete process.env.MICROSOFT_CLIENT_ID;
    else process.env.MICROSOFT_CLIENT_ID = savedMicrosoft;
    if (savedMicrosoftSecret === undefined) delete process.env.MICROSOFT_CLIENT_SECRET;
    else process.env.MICROSOFT_CLIENT_SECRET = savedMicrosoftSecret;
  }
});

import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomBytes, createHash } from "node:crypto";
import { fork } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { INTEGRATION_TOOLS, isCallTool, isCalendarTool, isEmailTool } from "./catalog";
import { graphPagePath, normalizeGoogleEvent, normalizeOutlookEvent } from "./calendars";
import { slackWebhook } from "./slack";

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sales-next-integrations-"));
process.env.SALES_COACH_DB_PATH = path.join(directory, "test.db");
process.env.INTEGRATION_ENCRYPTION_KEY = randomBytes(32).toString("base64");
process.env.PUBLIC_APP_URL = "https://coach.example.com";
for (const prefix of ["GOOGLE_CALENDAR", "MICROSOFT_CALENDAR", "CALENDLY"]) {
  process.env[`${prefix}_CLIENT_ID`] = "client-id"; process.env[`${prefix}_CLIENT_SECRET`] = "client-secret";
}
after(() => fs.rmSync(directory, { recursive: true, force: true }));
const start = new Date(Date.now() - 3600000).toISOString(); const end = new Date(Date.now() - 1800000).toISOString();
const google = { id: "g-1", summary: "Discovery", start: { dateTime: start }, end: { dateTime: end }, organizer: { email: "alex@example.com" }, attendees: [{ email: "alex@example.com" }, { email: "pat@acme.com" }], htmlLink: "https://calendar.google.com/event/1" };
const outlook = { id: "o-1", subject: "Discovery", start: { dateTime: start.slice(0, -1), timeZone: "UTC" }, end: { dateTime: end.slice(0, -1), timeZone: "UTC" }, attendees: [{ emailAddress: { name: "Pat", address: "pat@acme.com" } }], webLink: "https://outlook.office.com/calendar/item/1" };
const calendly = { uri: "https://api.calendly.com/scheduled_events/c-1", name: "Discovery", start_time: start, end_time: end, status: "active", event_memberships: [{ user_email: "alex@example.com", user_name: "Alex" }] };
const aircall = { id: 123, status: "done", started_at: Math.floor(Date.parse(start) / 1000), duration: 60, user: { id: 1, name: "Alex", email: "alex@example.com" }, contact: { first_name: "Pat", company_name: "Acme", emails: [{ value: "pat@acme.com" }] }, recording_short_url: "https://aircall.io/recording/123" };
const requests: { url: URL; init?: RequestInit }[] = [];
let googleRemoved = false; let googlePage = false; let outlookPage = false; let calendlyPage = false; let graphPageUnavailable = false; let inviteePage = false; let failSlack = false; let missingTranscript = false; let refreshed = 0;
let aircallHookState: "active" | "inactive" | "missing" = "active"; let aircallHookUrl = ""; let aircallSummary = "Budget discussed";
let refreshError = 0; let calendlyPermissionMissing = false;
const challenges = new Map<string, string>();
async function vendorFetch(input: any, init?: RequestInit) {
  const url = new URL(String(input)); requests.push({ url, init }); assert.equal(init?.redirect, "manual");
  assert.ok(!url.searchParams.has("access_token"));
  if (["oauth2.googleapis.com", "login.microsoftonline.com", "auth.calendly.com"].includes(url.hostname)) {
    const params = new URLSearchParams(String(init?.body));
    if (params.get("grant_type") === "refresh_token") { refreshed++; return refreshError ? new Response("invalid_grant", { status: refreshError }) : Response.json({ access_token: "refreshed-token", refresh_token: `rotated-refresh-${refreshed}`, expires_in: 3600, token_type: "Bearer" }); }
    assert.equal(params.get("grant_type"), "authorization_code");
    assert.equal(createHash("sha256").update(params.get("code_verifier") || "").digest("base64url"), challenges.get(url.hostname));
    assert.equal(params.get("redirect_uri"), `https://coach.example.com/app/api/integrations/oauth/${url.hostname === "auth.calendly.com" ? "calendly" : url.hostname === "oauth2.googleapis.com" ? "google-calendar" : "outlook-calendar"}/callback`);
    if (url.hostname === "auth.calendly.com") assert.equal((init?.headers as any).Authorization, `Basic ${Buffer.from("client-id:client-secret").toString("base64")}`);
    return Response.json({ access_token: "api-token", refresh_token: "refresh-token", expires_in: 3600, token_type: "Bearer" });
  }
  if (url.hostname === "www.googleapis.com") {
    if (url.pathname.endsWith("/primary")) return Response.json({ id: "alex@example.com" });
    return Response.json({ items: googleRemoved ? [] : url.searchParams.get("pageToken") ? [{ ...google, id: "g-2", attendees: [] }] : [google, { ...google, id: "all-day", start: { date: "2026-10-01" }, end: { date: "2026-10-02" } }], ...(googlePage && !url.searchParams.get("pageToken") ? { nextPageToken: "g-next" } : {}) });
  }
  if (url.hostname === "graph.microsoft.com") {
    if (url.pathname === "/v1.0/me") return Response.json({ mail: "alex@example.com" });
    if (url.pathname === "/v1.0/me/events") return Response.json({ value: [] });
    assert.ok(String((init?.headers as any).Prefer).includes("UTC"));
    if (graphPageUnavailable && url.searchParams.has("$skiptoken")) return new Response("unavailable", { status: 503 });
    return Response.json({ value: url.searchParams.has("$skiptoken") ? [{ ...outlook, id: "o-2", attendees: [] }] : [outlook, { ...outlook, id: "all-day", isAllDay: true }], ...(outlookPage && !url.searchParams.has("$skiptoken") ? { "@odata.nextLink": "https://graph.microsoft.com/v1.0/me/calendarView?$skiptoken=o-next" } : {}) });
  }
  if (url.hostname === "api.calendly.com") {
    if (url.pathname === "/users/me") return Response.json({ resource: { uri: "https://api.calendly.com/users/u-1", email: "alex@example.com" } });
    if (url.pathname.endsWith("/invitees")) return Response.json({ collection: [{ email: url.searchParams.get("page_token") ? "second@acme.com" : "pat@acme.com", name: "Pat", status: "active" }], pagination: inviteePage && !url.searchParams.get("page_token") ? { next_page_token: "invitees-next" } : {} });
    if (calendlyPermissionMissing) return new Response("missing_scope", { status: 403 });
    return Response.json({ collection: [{ ...calendly, ...(url.searchParams.get("page_token") ? { uri: "https://api.calendly.com/scheduled_events/c-2", status: "canceled" } : {}) }], pagination: calendlyPage && url.searchParams.get("count") === "100" && !url.searchParams.has("page_token") ? { next_page_token: "c-next" } : {} });
  }
  if (url.hostname === "api.aircall.io") {
    assert.equal((init?.headers as any).Authorization, `Basic ${Buffer.from("api-id:api-token").toString("base64")}`);
    if (url.pathname.endsWith("/webhooks")) { aircallHookState = "active"; aircallHookUrl = JSON.parse(String(init?.body)).url; return Response.json({ webhook: { webhook_id: "air-hook", token: "air-hook-token" } }, { status: 201 }); }
    if (url.pathname.endsWith("/webhooks/air-hook")) {
      if (init?.method === "PUT") { assert.equal(JSON.parse(String(init.body)).active, true); aircallHookState = "active"; }
      if (aircallHookState === "missing") return new Response("not found", { status: 404 });
      return Response.json({ webhook: { webhook_id: "air-hook", token: "air-hook-token", url: aircallHookUrl, active: aircallHookState === "active", events: ["transcription.created", "summary.created"] } });
    }
    if (url.pathname.endsWith("/transcription")) return missingTranscript ? new Response("no transcript", { status: 404 }) : Response.json({ transcription: { call_id: 123, call_created_at: start, content: { utterances: [{ participant_type: "internal", text: "What is your budget?", start_time: 2, end_time: 10 }, { participant_type: "external", text: "We have budget for this.", start_time: 11, end_time: 20 }] } } });
    if (url.pathname.endsWith("/summary")) return aircallSummary ? Response.json({ summary: { content: aircallSummary } }) : new Response("not ready", { status: 404 });
    if (url.pathname.endsWith("/123")) return Response.json({ call: aircall });
    return Response.json({ calls: [aircall], meta: {} });
  }
  if (url.hostname === "hooks.slack.com") return failSlack ? new Response("rate limited", { status: 429, headers: { "Retry-After": "120" } }) : new Response("ok");
  throw new Error("Unexpected provider host");
}
async function withVendors(fn: () => Promise<void>) { const original = global.fetch; global.fetch = vendorFetch; try { await fn(); } finally { global.fetch = original; } }

test("thirty-two providers classify schedules, mail, and alerts separately from transcript ingestion", () => {
  assert.equal(INTEGRATION_TOOLS.length, 32);
  for (const provider of ["calendly", "google-calendar", "outlook-calendar"]) { assert.ok(isCalendarTool(provider)); assert.ok(!isCallTool(provider)); assert.ok(!isEmailTool(provider)); }
  for (const provider of ["gmail", "outlook"]) { assert.ok(isEmailTool(provider)); assert.ok(!isCallTool(provider)); assert.ok(!isCalendarTool(provider)); }
  assert.ok(!isCallTool("slack")); assert.ok(isCallTool("aircall")); assert.ok(isCallTool("zoom")); assert.ok(isCallTool("google-meet")); assert.ok(isCallTool("microsoft-teams")); assert.ok(isCallTool("quo")); assert.ok(isCallTool("zapier"));
  for (const url of ["https://example.com/services/T1/B1/secret", "https://hooks.slack.com/services/T1/B1/secret?token=x", "http://hooks.slack.com/services/T1/B1/secret", "https://user:pass@hooks.slack.com/services/T1/B1/secret"]) assert.throws(() => slackWebhook(url));
  assert.equal(slackWebhook("https://hooks.slack.com/services/T1/B1/secret").hostname, "hooks.slack.com");
  assert.throws(() => graphPagePath("https://attacker.example/v1.0/me/calendarView"));
  assert.throws(() => graphPagePath("https://graph.microsoft.com/v1.0/me/messages"));
  assert.equal(normalizeOutlookEvent(outlook, "alex@example.com").startAt, start);
  assert.ok(normalizeGoogleEvent(google, "alex@example.com").participants.find(p => p.email === "pat@acme.com")?.external);
  const personal = normalizeGoogleEvent({ ...google, attendees: [{ email: "rep@gmail.com" }, { email: "customer@gmail.com" }] }, "rep@gmail.com");
  assert.equal(personal.participants[0].external, false); assert.equal(personal.participants[1].external, true);
});

test("OAuth binds authorization to admin, tenant and browser, consumes state once, and rotates refresh credentials", async () => withVendors(async () => {
  const { runWithTenant } = await import("../tenant"); const { startOAuth, finishOAuth, authorizedSecrets } = await import("./oauth");
  const { connectIntegration, getConnection, disconnectIntegration, saveConnectionSecrets } = await import("../revenue/connections");
  const { db } = await import("../db"); const { integrationOAuthStates } = await import("../db/schema"); const { eq } = await import("drizzle-orm");
  await runWithTenant("org-oauth", async () => {
    for (const provider of ["google-calendar", "outlook-calendar", "calendly"] as const) {
      const flow = await startOAuth(provider, "admin", { name: provider }, "https://coach.example.com"); const url = new URL(flow.url);
      assert.equal(url.searchParams.get("state"), flow.state);
      assert.equal(url.searchParams.get("code_challenge_method"), "S256");
      challenges.set(provider === "calendly" ? "auth.calendly.com" : provider === "google-calendar" ? "oauth2.googleapis.com" : "login.microsoftonline.com", url.searchParams.get("code_challenge")!);
      await assert.rejects(() => finishOAuth(provider, "admin", flow.state, "wrong-browser", "code"), /browser/);
      await assert.rejects(() => runWithTenant("org-other", () => finishOAuth(provider, "admin", flow.state, flow.state, "code")), /workspace/);
      await assert.rejects(() => finishOAuth(provider, "other-admin", flow.state, flow.state, "code"), /workspace/);
      const result = await finishOAuth(provider, "admin", flow.state, flow.state, "code");
      await assert.rejects(() => finishOAuth(provider, "admin", flow.state, flow.state, "code"), /expired/);
      const id = await connectIntegration({ provider, ...result.body }, "admin", result.secrets); const connection = await getConnection(id);
      assert.equal(connection.config.accountEmail, "alex@example.com");
      const secrets = { ...connection.secrets, expiresAt: "0" }; await saveConnectionSecrets(id, secrets);
      const before = refreshed;
      const values = await Promise.all([authorizedSecrets({ ...connection, secrets }), authorizedSecrets({ ...connection, secrets })]);
      assert.equal(refreshed - before, 1); assert.equal(values[0].refreshToken, `rotated-refresh-${refreshed}`);
      assert.equal((await getConnection(id)).secrets.token, "refreshed-token");
      await saveConnectionSecrets(id, { ...values[0], expiresAt: "0" });
      const again = await authorizedSecrets(await getConnection(id));
      assert.equal(again.refreshToken, `rotated-refresh-${refreshed}`);
      assert.equal(new URLSearchParams(String(requests.at(-1)!.init?.body)).get("refresh_token"), values[0].refreshToken);
      await disconnectIntegration(id, "admin"); await assert.rejects(() => saveConnectionSecrets(id, secrets), /not found/);
    }
    const expired = await startOAuth("google-calendar", "admin", {}, "https://coach.example.com");
    await db.update(integrationOAuthStates).set({ expiresAt: 0 }).where(eq(integrationOAuthStates.actor, "admin")).run();
    await assert.rejects(() => finishOAuth("google-calendar", "admin", expired.state, expired.state, "code"), /expired/);
  });
}));

test("separate workers share one token refresh lease, recover an expired lease, and preserve tokens during preference changes", async () => withVendors(async () => {
  const { runWithTenant } = await import("../tenant"); const { connectIntegration, getConnection, saveConnectionConfig } = await import("../revenue/connections");
  const { db } = await import("../db"); const { integrationOAuthRefreshLeases } = await import("../db/schema"); const { stableId } = await import("../revenue/security");
  await runWithTenant("org-refresh-workers", async () => {
    const id = await connectIntegration({ provider: "calendly", autoSync: false }, "admin", { token: "api-token", authType: "oauth", refreshToken: "one-use", expiresAt: "0" });
    const stale = await getConnection(id); const log = path.join(directory, "refresh-requests.txt");
    await db.insert(integrationOAuthRefreshLeases).values({ id: stableId("oauth-refresh", "org-refresh-workers", id), orgId: "org-refresh-workers", connectionId: id, token: "crashed-worker", expiresAt: 0 }).run();
    const script = path.join(directory, "refresh-worker.cjs");
    fs.writeFileSync(script, [
      `require(${JSON.stringify(require.resolve("tsx/cjs"))});`,
      'const fs = require("node:fs");',
      'const assert = require("node:assert/strict");',
      `const { runWithTenant } = require(${JSON.stringify(path.resolve("src/lib/tenant.ts"))});`,
      `const { getConnection } = require(${JSON.stringify(path.resolve("src/lib/revenue/connections.ts"))});`,
      `const { authorizedSecrets } = require(${JSON.stringify(path.resolve("src/lib/integrations/oauth.ts"))});`,
      'global.fetch = async (url, init) => {',
      '  assert.equal(String(url), "https://auth.calendly.com/oauth/token");',
      '  assert.equal(new URLSearchParams(String(init.body)).get("refresh_token"), "one-use");',
      `  fs.appendFileSync(${JSON.stringify(log)}, "refresh\\n");`,
      '  await new Promise(resolve => setTimeout(resolve, 500));',
      '  return Response.json({ access_token: "worker-access", refresh_token: "worker-rotated", expires_in: 3600, token_type: "Bearer" });',
      '};',
      'runWithTenant("org-refresh-workers", async () => {',
      `  const connection = await getConnection(${JSON.stringify(id)});`,
      '  const start = new Promise(resolve => process.on("message", message => { if (message === "start") resolve(); }));',
      '  process.send({ ready: true }); await start;',
      '  const secrets = await authorizedSecrets(connection);',
      '  process.send({ result: secrets.refreshToken }, () => process.exit(0));',
      '});',
    ].join("\n"));
    const children = [0, 1].map(() => fork(script, { execArgv: [], env: process.env, stdio: ["ignore", "ignore", "pipe", "ipc"] }));
    const receive = (child: typeof children[number], field: string) => new Promise<any>((resolve, reject) => {
      let diagnostic = ""; const output = (chunk: Buffer) => { diagnostic += chunk.toString(); }; child.stderr?.on("data", output);
      const cleanup = () => { clearTimeout(timer); child.off("message", message); child.off("error", failed); child.off("exit", exited); child.stderr?.off("data", output); };
      const failed = (error: Error) => { cleanup(); reject(error); };
      const exited = () => failed(new Error(`Refresh worker stopped: ${diagnostic}`));
      const message = (value: any) => { if (Object.hasOwn(value, field)) { cleanup(); resolve(value[field]); } };
      const timer = setTimeout(() => failed(new Error("Refresh worker timed out.")), 10000);
      child.on("message", message); child.once("error", failed); child.once("exit", exited);
    });
    try {
      await Promise.all(children.map(child => receive(child, "ready")));
      const results = children.map(child => receive(child, "result")); children.forEach(child => child.send("start"));
      assert.deepEqual(await Promise.all(results), ["worker-rotated", "worker-rotated"]);
      assert.equal(fs.readFileSync(log, "utf8"), "refresh\n");
      await saveConnectionConfig(id, { ...stale.config, autoSync: true });
      assert.equal((await getConnection(id)).secrets.refreshToken, "worker-rotated");
    } finally { children.forEach(child => child.kill()); }
  });
}));

test("missing Calendly event scope fails before saving, and invalid refresh grants fail with reconnect instructions", async () => withVendors(async () => {
  const { runWithTenant } = await import("../tenant"); const { connectIntegration, listConnections, getConnection } = await import("../revenue/connections");
  const { enqueueSync, processJobs, listJobs } = await import("../revenue/jobs");
  await runWithTenant("org-permissions", async () => {
    calendlyPermissionMissing = true;
    try { await assert.rejects(() => connectIntegration({ provider: "calendly", token: "api-token" }, "admin"), /permissions/); assert.equal((await listConnections()).length, 0); }
    finally { calendlyPermissionMissing = false; }
    const id = await connectIntegration({ provider: "calendly" }, "admin", { token: "api-token", authType: "oauth", refreshToken: "revoked", expiresAt: "0" });
    const jobId = await enqueueSync(id); refreshError = 400;
    try {
      assert.equal((await processJobs("org-permissions", 1, [jobId]))[0].status, "failed");
      assert.match((await listJobs())[0].lastError, /Disconnect and connect/);
      assert.equal((await getConnection(id)).status, "error");
    } finally { refreshError = 0; }
  });
}));

test("all three calendars import invitees, follow pagination, reconcile cancellations, match calls, and isolate workspaces", async () => withVendors(async () => {
  const { runWithTenant } = await import("../tenant"); const { connectIntegration } = await import("../revenue/connections"); const { enqueueJob, enqueueSync, processJobs } = await import("../revenue/jobs");
  const { listScheduledMeetings, meetingContextForCall, meetingMatchesCall } = await import("../revenue/meetings");
  const { importMeeting } = await import("../revenue/imports"); const { normalizedMeeting } = await import("./meeting"); const { getCallById } = await import("../db/service");
  await runWithTenant("org-calendars", async () => {
    googlePage = true; outlookPage = true; calendlyPage = true; inviteePage = true;
    const ids: string[] = [];
    for (const provider of ["google-calendar", "outlook-calendar", "calendly"] as const) {
      const id = await connectIntegration({ provider, token: "api-token" }, "admin", provider === "calendly" ? undefined : { token: "api-token", authType: "oauth", refreshToken: "refresh", expiresAt: String(Date.now() + 3600000) });
      ids.push(id); await enqueueSync(id); await processJobs("org-calendars", 10);
      const meetings = await listScheduledMeetings(id, true); assert.equal(meetings.length, 2, provider); assert.ok(meetings.some((m: any) => m.participants.some((p: any) => p.email === "pat@acme.com")));
      if (provider === "calendly") { assert.equal(meetings.find((m: any) => m.externalId === "c-1").participants.length, 3); assert.equal(meetings.find((m: any) => m.externalId === "c-2").status, "cancelled"); }
    }
    const imported = await importMeeting({ id: "call-feed", provider: "zapier", config: { defaultStage: "Discovery" } }, normalizedMeeting({ externalId: "call-1", transcriptText: "Alex: What is your budget?", createdAt: start, participants: [{ name: "Pat", email: "pat@acme.com", external: true }] }));
    const call = await getCallById(imported.callId); assert.ok(call);
    assert.equal((await meetingContextForCall(call, [{ name: "Pat", email: "PAT@ACME.COM", external: true }])).length, 3);
    assert.ok((await listScheduledMeetings(ids[0], true)).find((m: any) => m.externalId === "g-1").linkedCalls.includes(call.id));
    assert.ok(!meetingMatchesCall({ startAt: start, status: "scheduled", participants: [{ name: "Alex", email: "alex@example.com" }] }, { createdAt: start, participants: [{ name: "Alex", email: "alex@example.com", external: false }] }));
    assert.ok(!meetingMatchesCall({ startAt: start, status: "scheduled", participants: [{ name: "Alex", email: "alex@example.com", external: false }] }, { createdAt: start, participants: [{ name: "Alex", email: "alex@example.com", external: true }] }));
    googleRemoved = true;
    await enqueueJob({ kind: "sync", connectionId: ids[0], payload: { syncStartedAt: new Date().toISOString() }, key: "google-cancel" }); await processJobs("org-calendars", 10);
    assert.equal((await listScheduledMeetings(ids[0], true))[0].status, "cancelled");
    assert.equal((await meetingContextForCall(call, [{ name: "Pat", email: "pat@acme.com", external: true }])).length, 2);
    await runWithTenant("org-stranger", async () => { assert.equal((await listScheduledMeetings()).length, 0); assert.equal((await listScheduledMeetings(undefined, true)).length, 0); });
    googleRemoved = false; googlePage = false; outlookPage = false; calendlyPage = false; inviteePage = false;
  });
}));

test("a failed calendar page preserves existing meetings until the complete snapshot succeeds", async () => withVendors(async () => {
  const { runWithTenant } = await import("../tenant"); const { connectIntegration } = await import("../revenue/connections");
  const { enqueueSync, processJobs } = await import("../revenue/jobs"); const { storeScheduledMeeting, listScheduledMeetings } = await import("../revenue/meetings");
  const { db } = await import("../db"); const { scheduledMeetings, processingJobs } = await import("../db/schema"); const { and, eq } = await import("drizzle-orm");
  await runWithTenant("org-calendar-retry", async () => {
    const id = await connectIntegration({ provider: "outlook-calendar" }, "admin", { token: "api-token", authType: "oauth", refreshToken: "refresh", expiresAt: String(Date.now() + 3600000) });
    await storeScheduledMeeting({ id, provider: "outlook-calendar" }, { ...normalizeOutlookEvent(outlook, "alex@example.com"), externalId: "previous-meeting" });
    await db.update(scheduledMeetings).set({ syncedAt: "2000-01-01T00:00:00.000Z" }).where(eq(scheduledMeetings.orgId, "org-calendar-retry")).run();
    outlookPage = true; graphPageUnavailable = true;
    try {
      await enqueueSync(id); const first = await processJobs("org-calendar-retry", 10);
      assert.ok(first.some(job => job.status === "queued"));
      assert.equal((await listScheduledMeetings(id, true)).find((meeting: any) => meeting.externalId === "previous-meeting").status, "scheduled");
      graphPageUnavailable = false;
      await db.update(processingJobs).set({ availableAt: new Date().toISOString() }).where(and(eq(processingJobs.orgId, "org-calendar-retry"), eq(processingJobs.status, "queued"))).run();
      await processJobs("org-calendar-retry", 10);
      const meetings = await listScheduledMeetings(id, true);
      assert.equal(meetings.find((meeting: any) => meeting.externalId === "previous-meeting").status, "cancelled");
      assert.equal(meetings.filter((meeting: any) => meeting.status === "scheduled").length, 2);
    } finally { outlookPage = false; graphPageUnavailable = false; }
  });
}));

test("Aircall history and authenticated ready events import once, enrich summaries, and revoke on disconnect", async () => withVendors(async () => {
  const { runWithTenant } = await import("../tenant"); const { connectIntegration, getConnection, disconnectIntegration } = await import("../revenue/connections");
  const { enableLiveFeed, acceptLiveWebhook } = await import("./live"); const { enqueueSync, processJobs } = await import("../revenue/jobs");
  const { importedCallId } = await import("../revenue/imports"); const { getCallById } = await import("../db/service"); const { conversationDetail } = await import("../revenue/conversations");
  await runWithTenant("org-aircall", async () => {
    const id = await connectIntegration({ provider: "aircall", apiId: "api-id", token: "api-token" }, "admin");
    const feed = await enableLiveFeed(id, "admin"); const before = requests.length; await enableLiveFeed(id, "admin"); assert.equal(requests.length, before + 1);
    assert.equal(requests.at(-1)!.init?.method, undefined);
    aircallHookState = "inactive"; await enableLiveFeed(id, "admin"); assert.equal(requests.at(-1)!.init?.method, "PUT");
    aircallHookState = "missing"; await enableLiveFeed(id, "admin"); assert.equal(requests.at(-1)!.init?.method, "POST");
    aircallSummary = "";
    await enqueueSync(id); await processJobs("org-aircall", 10);
    const call = await getCallById(importedCallId("org-aircall", id, "123")); assert.ok(call); const detail = await conversationDetail(call);
    assert.equal(detail.source, "aircall"); assert.equal(detail.summary, ""); assert.equal(detail.segments[0].start, 2); assert.equal(detail.participants[1].email, "pat@acme.com");
    aircallSummary = "Budget discussed";
    await (await import("../revenue/jobs")).enqueueJob({ kind: "sync", connectionId: id, payload: { syncStartedAt: new Date().toISOString() }, key: "summary-fallback" });
    await processJobs("org-aircall", 10); assert.equal((await conversationDetail(call)).summary, "Budget discussed");
    const body = JSON.stringify({ event: "transcription.created", token: "air-hook-token", data: { call_id: 123 } });
    await assert.rejects(() => acceptLiveWebhook("aircall", id, new Headers(), body.replace("air-hook-token", "wrong-token"), feed.url), /signature|token/);
    const first = await acceptLiveWebhook("aircall", id, new Headers(), body, feed.url); const second = await acceptLiveWebhook("aircall", id, new Headers(), body, feed.url); assert.equal(first.jobId, second.jobId);
    await processJobs("org-aircall", 1, [first.jobId!]); assert.ok((await getConnection(id)).config.lastWebhookAt);
    missingTranscript = true; assert.equal(await (await import("./aircall")).fetchAircallCall({ apiId: "api-id", token: "api-token" }, aircall), null); missingTranscript = false;
    await disconnectIntegration(id, "admin"); await assert.rejects(() => acceptLiveWebhook("aircall", id, new Headers(), body, feed.url), /not found/);
  });
}));

test("Slack stays silent until opted in, sends safe coaching alerts, retries limits, and cancels revoked alerts", async () => withVendors(async () => {
  const { runWithTenant } = await import("../tenant"); const { connectIntegration, getConnection, saveConnectionSecrets, disconnectIntegration } = await import("../revenue/connections");
  const { enqueueJob, processJobs, listJobs } = await import("../revenue/jobs"); const { queueSlackAlerts } = await import("./slack"); const { normalizedMeeting } = await import("./meeting");
  const { importMeeting } = await import("../revenue/imports"); const { getCallById } = await import("../db/service"); const { updateConversation } = await import("../revenue/conversations");
  await runWithTenant("org-slack", async () => {
    const before = requests.length; const id = await connectIntegration({ provider: "slack", webhookUrl: "https://hooks.slack.com/services/T1/B1/secret" }, "admin"); assert.equal(requests.length, before);
    const imported = await importMeeting({ id: "calls", provider: "zapier", config: { defaultStage: "Discovery" } }, normalizedMeeting({ externalId: "one", transcriptText: "Alex: Hello.", title: "<@everyone> coaching", createdAt: start }));
    await queueSlackAlerts("reviewed", imported.callId, "event-off"); assert.equal((await listJobs()).length, 0);
    const connection = await getConnection(id); await saveConnectionSecrets(id, connection.secrets, { ...connection.config, notifyReviewed: true, notifyClips: true, notifyLowScore: true });
    const call = await getCallById(imported.callId); assert.ok(call);
    const auth: any = { isAdmin: true, userId: "admin", name: "Manager", canViewAllCalls: true };
    await updateConversation(auth, call, { action: "review", reviewed: true }); await updateConversation(auth, call, { action: "review", reviewed: true });
    await updateConversation(auth, call, { action: "clip", title: "Good question", collection: "Examples", start: 0, end: 1 });
    await processJobs("org-slack", 10);
    const sent = requests.filter(r => r.url.hostname === "hooks.slack.com"); assert.equal(sent.length, 2);
    const body = JSON.parse(String(sent[0].init?.body)); assert.equal(body.blocks[1].text.type, "plain_text"); assert.equal(body.unfurl_links, false);
    assert.ok(body.blocks.at(-1).elements[0].url.startsWith("https://coach.example.com/app/calls/"));
    assert.equal((await getConnection(id)).status, "connected");
    const { db } = await import("../db"); const { evaluations } = await import("../db/schema"); const { eq } = await import("drizzle-orm");
    await db.insert(evaluations).values({ id: "slack-score", orgId: "org-slack", callId: call.id, repId: call.repId, bottomLine: "Ask a clearer follow-up question.",
      painStatus: "Incomplete", painEvidence: "", budgetStatus: "Incomplete", budgetEvidence: "", decisionStatus: "Incomplete", decisionEvidence: "",
      scriptAdherenceScore: 5, scriptFeedback: "", missedOpportunities: "[]", topFixes: "[]", createdAt: new Date().toISOString() }).run();
    await queueSlackAlerts("low-score", call.id, "at-threshold"); assert.equal((await listJobs()).length, 2);
    await db.update(evaluations).set({ scriptAdherenceScore: 4 }).where(eq(evaluations.id, "slack-score")).run();
    await queueSlackAlerts("low-score", call.id, "low-score-first"); await queueSlackAlerts("low-score", call.id, "low-score-first"); assert.equal((await listJobs()).length, 3);
    // A newer score can make an already queued alert unnecessary before delivery.
    await db.update(evaluations).set({ scriptAdherenceScore: 6 }).where(eq(evaluations.id, "slack-score")).run();
    await processJobs("org-slack", 10); assert.equal(requests.filter(r => r.url.hostname === "hooks.slack.com").length, 2);
    await db.update(evaluations).set({ scriptAdherenceScore: 3 }).where(eq(evaluations.id, "slack-score")).run();
    await queueSlackAlerts("low-score", call.id, "low-score-second"); await processJobs("org-slack", 10);
    const latestAlert = requests.filter(r => r.url.hostname === "hooks.slack.com"); assert.equal(latestAlert.length, 3);
    assert.match(JSON.parse(String(latestAlert.at(-1)!.init?.body)).blocks[1].text.text, /Script score 3\/10/);
    const jobId = await enqueueJob({ kind: "notify-slack", connectionId: id, payload: { event: "test" }, key: "rate-limit-test" }); failSlack = true;
    assert.equal((await processJobs("org-slack", 1, [jobId]))[0].status, "queued"); failSlack = false;
    assert.match((await listJobs()).find((j: any) => j.id === jobId).lastError, /rate limit/);
    await disconnectIntegration(id, "admin"); assert.equal((await listJobs()).find((j: any) => j.id === jobId).status, "cancelled");
    await runWithTenant("org-stranger", async () => { assert.equal((await listJobs()).length, 0); await assert.rejects(() => getConnection(id)); });
  });
}));

async function drainStress(orgId: string) {
  const { processJobs } = await import("../revenue/jobs");
  for (let round = 0; round < 100; round++) {
    const outcomes = await Promise.all(Array.from({ length: 4 }, () => processJobs(orgId, 10)));
    if (!outcomes.flat().length) return;
  }
  assert.fail("Calendar/notification jobs exceeded the bounded stress run");
}

test("calendars and Aircall handle 200 concurrent full-sync requests across 500 leased jobs", async () => withVendors(async () => {
  const { runWithTenant } = await import("../tenant"); const { connectIntegration } = await import("../revenue/connections");
  const { enqueueJob } = await import("../revenue/jobs"); const { listScheduledMeetings } = await import("../revenue/meetings");
  const { db } = await import("../db"); const { processingJobs, callMetadata } = await import("../db/schema"); const { eq } = await import("drizzle-orm");
  googlePage = true; outlookPage = true; calendlyPage = true; inviteePage = true;
  try {
    await runWithTenant("org-calendar-stress", async () => {
      for (const provider of ["google-calendar", "outlook-calendar", "calendly", "aircall"]) {
        const id = provider === "aircall" ? await connectIntegration({ provider, apiId: "api-id", token: "api-token" }, "admin")
          : await connectIntegration({ provider }, "admin", { token: "api-token", authType: "oauth", refreshToken: "refresh", expiresAt: String(Date.now() + 3600000) });
        await Promise.all(Array.from({ length: 50 }, (_, index) => enqueueJob({ kind: "sync", connectionId: id, payload: { full: true, syncStartedAt: new Date().toISOString() }, key: `${id}:stress:${index}` })));
        await drainStress("org-calendar-stress");
        if (provider === "aircall") assert.equal((await db.select().from(callMetadata).where(eq(callMetadata.connectionId, id)).all()).length, 1);
        else {
          const meetings = await listScheduledMeetings(id, true); assert.equal(meetings.length, 2, provider);
          if (provider === "calendly") assert.ok(meetings.some((meeting: any) => meeting.participants.some((p: any) => p.email === "second@acme.com")));
        }
      }
      const jobs = await db.select().from(processingJobs).where(eq(processingJobs.orgId, "org-calendar-stress")).all();
      assert.equal(jobs.length, 500); assert.ok(jobs.every((job: any) => job.status === "completed"));
    });
  } finally { googlePage = false; outlookPage = false; calendlyPage = false; inviteePage = false; }
}));

test("Slack coalesces a 300-alert burst under four workers and delivers distinct tests once", async () => withVendors(async () => {
  const { runWithTenant } = await import("../tenant"); const { connectIntegration, getConnection, saveConnectionConfig } = await import("../revenue/connections");
  const { queueSlackAlerts } = await import("./slack"); const { enqueueJob } = await import("../revenue/jobs");
  const { importMeeting } = await import("../revenue/imports"); const { normalizedMeeting } = await import("./meeting");
  const { getCallById } = await import("../db/service"); const { updateConversation } = await import("../revenue/conversations");
  await runWithTenant("org-slack-stress", async () => {
    const id = await connectIntegration({ provider: "slack", webhookUrl: "https://hooks.slack.com/services/T1/B1/secret" }, "admin");
    const connection = await getConnection(id); await saveConnectionConfig(id, { ...connection.config, notifyReviewed: true });
    const imported = await importMeeting({ id: "feed", provider: "zapier", config: { defaultStage: "Discovery" } }, normalizedMeeting({ externalId: "alert-stress", transcriptText: "Rep: Next step." }));
    const call = await getCallById(imported.callId); assert.ok(call);
    await updateConversation({ isAdmin: true, userId: "admin", canViewAllCalls: true } as any, call, { action: "review", reviewed: true });
    const before = requests.filter(request => request.url.hostname === "hooks.slack.com").length;
    await Promise.all(Array.from({ length: 300 }, () => queueSlackAlerts("reviewed", call.id, "same-event")));
    await Promise.all(Array.from({ length: 20 }, (_, index) => enqueueJob({ kind: "notify-slack", connectionId: id, payload: { event: "test" }, key: `distinct-test-${index}` })));
    await drainStress("org-slack-stress");
    assert.equal(requests.filter(request => request.url.hostname === "hooks.slack.com").length, before + 22);
  });
}));

test("all calendar and Aircall adapters reject malformed pages and preserve safe retry metadata", async () => {
  const { calendarProviderPage } = await import("./calendars"); const { aircallPage } = await import("./aircall"); const original = global.fetch;
  const adapters = [...["google-calendar", "outlook-calendar", "calendly"].map(provider => () => calendarProviderPage(provider as any, "private-token", { userUri: "https://api.calendly.com/users/u-1" } as any, {})), () => aircallPage({ apiId: "id", token: "private-token" }, {})];
  try {
    global.fetch = async () => Response.json({ items: {}, value: {}, collection: {}, calls: {} });
    for (const adapter of adapters) await assert.rejects(adapter, /invalid/);
    for (const status of [429, 503]) {
      global.fetch = async () => new Response("private-token echoed by vendor", { status, headers: { "Retry-After": "120" } });
      for (const adapter of adapters) await assert.rejects(adapter, (error: any) => { assert.equal(error.providerStatus, status); assert.equal(error.retryAfterSeconds, 120); assert.ok(!error.message.includes("private-token")); return true; });
    }
  } finally { global.fetch = original; }
});

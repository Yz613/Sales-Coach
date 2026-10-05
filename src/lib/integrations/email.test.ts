import assert from "node:assert/strict";
import { after, test } from "node:test";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AuthUser } from "../auth";

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sales-email-"));
process.env.SALES_COACH_DB_PATH = path.join(directory, "test.db");
process.env.INTEGRATION_ENCRYPTION_KEY = randomBytes(32).toString("base64");
process.env.PUBLIC_APP_URL = "https://coach.example.com";
const savedGoogle = process.env.GOOGLE_CLIENT_ID;
const savedGoogleSecret = process.env.GOOGLE_CLIENT_SECRET;
delete process.env.GOOGLE_CLIENT_ID;
delete process.env.GOOGLE_CLIENT_SECRET;
process.env.GOOGLE_CALENDAR_CLIENT_ID = "calendar-client";
process.env.GOOGLE_CALENDAR_CLIENT_SECRET = "calendar-secret";
process.env.MICROSOFT_CLIENT_ID = "ms-client";
process.env.MICROSOFT_CLIENT_SECRET = "ms-secret";
after(() => {
  if (savedGoogle === undefined) delete process.env.GOOGLE_CLIENT_ID;
  else process.env.GOOGLE_CLIENT_ID = savedGoogle;
  if (savedGoogleSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
  else process.env.GOOGLE_CLIENT_SECRET = savedGoogleSecret;
  fs.rmSync(directory, { recursive: true, force: true });
});

const admin: AuthUser = {
  userId: "manager", role: "admin", isAdmin: true, isMember: false, isClerkConfigured: false,
  canViewAllCalls: true, tenantId: "org-mail", clerkPlanId: null, billingPaid: true, name: "Manager", email: "alex@example.com",
};
const rep: AuthUser = { ...admin, userId: "rep-sam", role: "member", isAdmin: false, isMember: true, canViewAllCalls: false, name: "Sam", email: "sam@example.com" };
const BODY = "FULL BODY SECRET that must never be stored in the workspace database.";
const sentAt = new Date(Date.now() - 3600_000).toISOString();

function gmailMessage(id: string, from: string, to: string, snippet: string) {
  return {
    id, threadId: `thread-${id}`, snippet, internalDate: String(Date.parse(sentAt)),
    payload: {
      headers: [
        { name: "From", value: `Pat Buyer <${from}>` },
        { name: "To", value: to },
        { name: "Subject", value: `Hello ${id}` },
        { name: "Date", value: sentAt },
      ],
      body: { data: Buffer.from(BODY).toString("base64") },
      parts: [{ mimeType: "text/plain", body: { data: Buffer.from(BODY).toString("base64"), size: BODY.length } }],
    },
  };
}

test("matching ignores excluded and consumer domains and keeps only a snippet", async () => {
  const { buildMailIndex, clipSnippet, normalizeGmailMessage, normalizeOutlookMessage, filterEmailsForViewer } = await import("./email");
  const records = [
    { id: "company-1", kind: "company", email: null, domain: "acme.com", associations: [] },
    { id: "company-gmail", kind: "company", email: null, domain: "gmail.com", associations: [] },
    { id: "contact-1", kind: "contact", email: "pat@acme.com", domain: null, associations: [] },
    { id: "contact-personal", kind: "contact", email: "pat@gmail.com", domain: null, associations: [] },
    { id: "deal-a", kind: "deal", email: null, domain: null, associations: ["company-1", "contact-1", "contact-personal", "company-gmail"] },
  ];
  const index = buildMailIndex(records, ["internal.example"]);
  assert.deepEqual(index.match([{ email: "person@acme.com" }])?.accountIds, ["company-1"]);
  assert.ok(index.match([{ email: "pat@gmail.com" }])?.dealIds.includes("deal-a"));
  assert.equal(index.match([{ email: "stranger@gmail.com" }]), null);
  assert.equal(index.match([{ email: "ceo@internal.example" }]), null);
  assert.equal(index.match([{ email: "pat@acme.com" }])?.dealIds.includes("deal-a"), true);
  const blocked = buildMailIndex(records, ["gmail.com"]);
  assert.equal(blocked.match([{ email: "pat@gmail.com" }]), null);

  const gmail = normalizeGmailMessage(gmailMessage("abc123", "pat@acme.com", "alex@example.com", "Short snippet about pricing."), "alex@example.com");
  assert.equal(gmail?.direction, "inbound");
  assert.equal(gmail?.snippet, "Short snippet about pricing.");
  assert.equal(JSON.stringify(gmail).includes(BODY), false);
  assert.equal(clipSnippet("x".repeat(500)).length, 280);
  const outlook = normalizeOutlookMessage({
    id: "graph-1", conversationId: "conv-1", subject: "Pricing", bodyPreview: "Outlook preview only.",
    body: { content: BODY, contentType: "text" }, isDraft: false, receivedDateTime: sentAt,
    from: { emailAddress: { name: "Alex", address: "alex@example.com" } },
    toRecipients: [{ emailAddress: { name: "Pat", address: "pat@acme.com" } }],
  }, "alex@example.com");
  assert.equal(outlook?.direction, "outbound");
  assert.equal(outlook?.snippet, "Outlook preview only.");
  assert.equal(JSON.stringify(outlook).includes("FULL BODY"), false);
  assert.equal(normalizeOutlookMessage({ ...outlook, id: "draft", isDraft: true, receivedDateTime: sentAt }, "alex@example.com"), null);
  assert.equal(filterEmailsForViewer(admin, [{ ownerUserId: "rep-sam" }, { ownerUserId: "manager" }]).length, 2);
  assert.deepEqual(filterEmailsForViewer(rep, [{ ownerUserId: "rep-sam" }, { ownerUserId: "manager" }]).map(row => row.ownerUserId), ["rep-sam"]);
  assert.equal(filterEmailsForViewer({ ...rep, userId: null }, [{ ownerUserId: "rep-sam" }]).length, 0);
});

test("mocked Gmail and Outlook sync stores matching snippets and respects privacy, exclusions, and missing secrets", async () => {
  const { oauthAvailability, startOAuth } = await import("./oauth");
  assert.equal(oauthAvailability().gmail, true);
  assert.equal(oauthAvailability().outlook, true);
  const started = await (async () => {
    const { runWithTenant } = await import("../tenant");
    return runWithTenant("org-mail", () => startOAuth("gmail", "manager", { name: "Gmail", autoSync: true }, "https://coach.example.com"));
  })();
  assert.equal(new URL(started.url).searchParams.get("client_id"), "calendar-client");
  delete process.env.GOOGLE_CALENDAR_CLIENT_ID;
  delete process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  assert.equal(oauthAvailability().gmail, false);
  const { runWithTenant } = await import("../tenant");
  await assert.rejects(runWithTenant("org-mail", () => startOAuth("gmail", "manager", { name: "Gmail" }, "https://coach.example.com")), (error: { status?: number }) => error.status === 503);
  process.env.GOOGLE_CALENDAR_CLIENT_ID = "calendar-client";
  process.env.GOOGLE_CALENDAR_CLIENT_SECRET = "calendar-secret";

  const original = global.fetch;
  global.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname === "/gmail/v1/users/me/profile") return Response.json({ emailAddress: "alex@example.com" });
    if (url.pathname === "/gmail/v1/users/me/messages" && !url.pathname.includes("/messages/")) {
      if (url.searchParams.has("q")) throw new Error("gmail.metadata cannot use q");
      return Response.json({ messages: [{ id: "match1" }, { id: "noise1" }, { id: "excluded1" }, { id: "draft1" }, { id: "oldmsg" }] });
    }
    if (url.pathname.endsWith("/draft1")) return Response.json({ ...gmailMessage("draft1", "pat@acme.com", "alex@example.com", "Draft snippet that must stay out."), labelIds: ["DRAFT"] });
    if (url.pathname.endsWith("/oldmsg")) return Response.json({ ...gmailMessage("oldmsg", "pat@acme.com", "alex@example.com", "Ancient snippet that is outside the window."), internalDate: String(Date.now() - 400 * 86400000) });
    if (url.pathname.endsWith("/match1")) return Response.json(gmailMessage("match1", "pat@acme.com", "alex@example.com", "Can we review the proposal snippet?"));
    if (url.pathname.endsWith("/noise1")) return Response.json(gmailMessage("noise1", "news@newsletter.test", "alex@example.com", "Unrelated newsletter snippet."));
    if (url.pathname.endsWith("/excluded1")) return Response.json(gmailMessage("excluded1", "boss@internal.example", "alex@example.com", "Internal only snippet."));
    if (url.pathname === "/v1.0/me") return Response.json({ mail: "sam@example.com", userPrincipalName: "sam@example.com" });
    if (url.pathname === "/v1.0/me/messages" && url.searchParams.get("$top") === "1") return Response.json({ value: [] });
    if (url.pathname === "/v1.0/me/messages") {
      return Response.json({ value: [{
        id: "graph-match", conversationId: "conv", subject: "Account follow up", bodyPreview: "Graph preview for the Acme account.",
        body: { content: BODY }, isDraft: false, receivedDateTime: sentAt,
        from: { emailAddress: { address: "buyer@acme.com", name: "Buyer" } },
        toRecipients: [{ emailAddress: { address: "sam@example.com", name: "Sam" } }],
      }, {
        id: "graph-noise", subject: "Nope", bodyPreview: "No match preview.", isDraft: false, receivedDateTime: sentAt,
        from: { emailAddress: { address: "other@elsewhere.test" } }, toRecipients: [{ emailAddress: { address: "sam@example.com" } }],
      }] });
    }
    throw new Error(`Unexpected ${url.pathname}`);
  }) as typeof fetch;

  try {
    const { connectIntegration, disconnectIntegration, getConnection } = await import("../revenue/connections");
    const { enqueueSync, processJobs, scheduleSyncs } = await import("../revenue/jobs");
    const { saveEmailCaptureSettings, visibleDealEmails } = await import("./email");
    const { db } = await import("../db");
    const { crmRecords, emailMessages } = await import("../db/schema");
    const { eq } = await import("drizzle-orm");
    await runWithTenant("org-mail", async () => {
      await saveEmailCaptureSettings({ enabled: false, domains: "internal.example\n" });
      await db.insert(crmRecords).values([
        { id: "company-1", orgId: "org-mail", connectionId: "crm", provider: "hubspot", externalId: "c1", kind: "company", name: "Acme", domain: "acme.com", syncedAt: sentAt },
        { id: "contact-1", orgId: "org-mail", connectionId: "crm", provider: "hubspot", externalId: "p1", kind: "contact", name: "Pat", email: "pat@acme.com", syncedAt: sentAt },
        { id: "deal-a", orgId: "org-mail", connectionId: "crm", provider: "hubspot", externalId: "d1", kind: "deal", name: "Acme expansion", associations: JSON.stringify(["company-1", "contact-1"]), syncedAt: sentAt },
      ]).run();
      const gmail = await connectIntegration({ provider: "gmail", name: "Alex Gmail" }, "manager", { token: "gmail-token", authType: "oauth", refreshToken: "refresh", expiresAt: String(Date.now() + 3600_000) });
      assert.equal((await getConnection(gmail)).config.ownerUserId, "manager");
      assert.equal((await getConnection(gmail)).config.accountEmail, "alex@example.com");
      await assert.rejects(enqueueSync(gmail), /email capture/i);
      await scheduleSyncs();
      assert.equal((await processJobs("org-mail", 5)).length, 0);
      await saveEmailCaptureSettings({ enabled: true, domains: "internal.example" });
      await enqueueSync(gmail);
      await processJobs("org-mail", 5);
      const outlook = await connectIntegration({ provider: "outlook", name: "Sam Outlook" }, "rep-sam", { token: "outlook-token", authType: "oauth", refreshToken: "refresh", expiresAt: String(Date.now() + 3600_000) });
      await enqueueSync(outlook);
      await processJobs("org-mail", 5);
      const rows = await db.select().from(emailMessages).where(eq(emailMessages.orgId, "org-mail")).all();
      assert.equal(rows.length, 2);
      assert.equal(rows.some((row: { snippet: string }) => row.snippet.includes("proposal snippet")), true);
      assert.equal(rows.some((row: { snippet: string }) => row.snippet.includes("Acme account")), true);
      assert.equal(JSON.stringify(rows).includes("FULL BODY"), false);
      assert.equal(JSON.stringify(rows).includes("Unrelated newsletter"), false);
      assert.equal(JSON.stringify(rows).includes("Internal only"), false);
      assert.equal(JSON.stringify(rows).includes("Draft snippet"), false);
      assert.equal(JSON.stringify(rows).includes("Ancient snippet"), false);
      const managerView = await visibleDealEmails(admin, "deal-a");
      assert.equal(managerView.length, 2);
      assert.ok(managerView.some(email => email.direction === "inbound" && email.subject === "Hello match1"));
      assert.ok(managerView.some(email => email.accountNames.includes("Acme")));
      const repView = await visibleDealEmails(rep, "deal-a");
      assert.equal(repView.length, 1);
      assert.equal(repView[0].ownerUserId, "rep-sam");
      assert.equal(repView[0].provider, "outlook");
      await saveEmailCaptureSettings({ enabled: false });
      assert.equal((await visibleDealEmails(admin, "deal-a")).length, 0);
      await disconnectIntegration(gmail, "manager");
      const remaining = await db.select().from(emailMessages).where(eq(emailMessages.orgId, "org-mail")).all();
      assert.equal(remaining.length, 1);
      assert.equal(remaining[0].provider, "outlook");
    });
  } finally {
    global.fetch = original;
  }
});

test("email capture save is not a nested form and the settings API persists it", async () => {
  const source = fs.readFileSync(path.join(process.cwd(), "src/app/admin/settings/page.tsx"), "utf8");
  const forms = source.match(/<\/?form\b/g) || [];
  assert.deepEqual(forms, ["<form", "</form"]);
  const email = source.slice(source.indexOf(">Email capture<"), source.indexOf(">Invite emails<"));
  assert.equal(email.includes("<form"), false);
  assert.match(email, /type="button"/);
  assert.match(email, /saveEmailCapture/);

  const { runWithAuth } = await import("../auth");
  const { runWithTenant } = await import("../tenant");
  const route = await import("../../app/api/admin/settings/route");
  const save = (body: Record<string, unknown>) => runWithAuth(admin, () => route.POST(new Request("http://127.0.0.1/app/api/admin/settings", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  })));
  const saved = await save({ emailCaptureEnabled: true, emailExcludedDomains: "internal.example" });
  assert.equal(saved.status, 200);
  const reload = await runWithAuth(admin, () => (route.GET as (request: Request) => Promise<Response>)(new Request("http://127.0.0.1/app/api/admin/settings")));
  assert.equal(reload.status, 200);
  const data = await reload.json();
  assert.equal(data.emailCapture.enabled, true);
  assert.deepEqual(data.emailCapture.excludedDomains, ["internal.example"]);
  await runWithTenant("local", async () => {
    const { getSetting } = await import("../db/service");
    assert.equal(await getSetting("email_capture_enabled"), "1");
  });
  assert.equal((await save({ emailCaptureEnabled: false, emailExcludedDomains: "internal.example" })).status, 200);
  const off = await runWithAuth(admin, () => (route.GET as (request: Request) => Promise<Response>)(new Request("http://127.0.0.1/app/api/admin/settings")));
  assert.equal((await off.json()).emailCapture.enabled, false);
});

test("gmail consent accepts the metadata scope URL in any order and capture off does not block connect", async () => {
  process.env.GOOGLE_CLIENT_ID = "gmail-web-client";
  process.env.GOOGLE_CLIENT_SECRET = "gmail-web-secret";
  const { scopeGrantIncludes, startOAuth, OAUTH_COOKIE } = await import("./oauth");
  assert.equal(scopeGrantIncludes("https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/gmail.metadata", "https://www.googleapis.com/auth/gmail.metadata"), true);
  assert.equal(scopeGrantIncludes("gmail.metadata", "https://www.googleapis.com/auth/gmail.metadata"), true);
  assert.equal(scopeGrantIncludes("https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/gmail.metadata"), false);
  const { runWithTenant } = await import("../tenant");
  const { runWithAuth } = await import("../auth");
  const started = await runWithTenant("local", () => startOAuth("gmail", "manager", { name: "Gmail", autoSync: true }, "https://coach.example.com"));
  const authorize = new URL(started.url);
  assert.equal(authorize.searchParams.get("client_id"), "gmail-web-client");
  const redirectUri = authorize.searchParams.get("redirect_uri");
  const logged: unknown[][] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => { logged.push(args); };
  const original = global.fetch;
  let profileCalls = 0;
  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.origin === "https://oauth2.googleapis.com") {
      const params = Object.fromEntries(new URLSearchParams(String(init?.body)));
      assert.equal(params.client_id, "gmail-web-client");
      assert.equal(params.client_secret, "gmail-web-secret");
      assert.equal(params.redirect_uri, redirectUri);
      const scope = url.searchParams.get("scope-fixture") || "https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/gmail.metadata";
      return Response.json({ access_token: "gmail-access", refresh_token: "gmail-refresh", expires_in: 3600, token_type: "Bearer", scope });
    }
    if (url.pathname === "/gmail/v1/users/me/profile") {
      profileCalls += 1;
      return Response.json({ emailAddress: "yehuda@gmail.com" });
    }
    throw new Error(`Unexpected ${url.href}`);
  }) as typeof fetch;
  try {
    const { saveEmailCaptureSettings } = await import("./email");
    await runWithTenant("local", () => saveEmailCaptureSettings({ enabled: false, domains: "" }));
    const { GET } = await import("../../app/api/integrations/oauth/[provider]/callback/route");
    const { listConnections } = await import("../revenue/connections");
    const { enqueueSync } = await import("../revenue/jobs");
    const callback = (state: string) => runWithAuth(admin, () => GET(new Request(`http://127.0.0.1/app/api/integrations/oauth/gmail/callback?code=one-use-code&state=${state}`, {
      headers: { cookie: `${OAUTH_COOKIE}=${state}` },
    }), { params: Promise.resolve({ provider: "gmail" }) }));
    const response = await callback(started.state);
    assert.equal(response.status, 303);
    const location = new URL(response.headers.get("location") || "");
    assert.equal(location.pathname, "/app/admin/integrations/gmail");
    assert.equal(location.searchParams.get("connected"), "1");
    assert.equal(location.searchParams.get("sync"), "held");
    assert.equal(location.searchParams.get("connectionError"), null);
    const connections = await runWithTenant("local", () => listConnections());
    const gmail = connections.find((row: { provider: string; id: string; config: { accountEmail?: string } }) => row.provider === "gmail");
    assert.ok(gmail);
    assert.equal(gmail.config.accountEmail, "yehuda@gmail.com");
    await assert.rejects(runWithTenant("local", () => enqueueSync(gmail.id)), /email capture/i);

    const denied = await runWithTenant("local", () => startOAuth("gmail", "manager", { name: "Gmail" }, "https://coach.example.com"));
    global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.origin === "https://oauth2.googleapis.com") {
        return Response.json({ access_token: "gmail-access", refresh_token: "gmail-refresh", expires_in: 3600, token_type: "Bearer", scope: "https://www.googleapis.com/auth/calendar.readonly" });
      }
      profileCalls += 1;
      return Response.json({ emailAddress: "should-not-run@gmail.com" });
    }) as typeof fetch;
    const beforeProfile = profileCalls;
    const missing = await callback(denied.state);
    const missingLocation = new URL(missing.headers.get("location") || "");
    assert.match(missingLocation.searchParams.get("connectionError") || "", /did not grant Gmail metadata/);
    assert.equal(profileCalls, beforeProfile);

    const blocked = await runWithTenant("local", () => startOAuth("gmail", "manager", { name: "Gmail" }, "https://coach.example.com"));
    global.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.origin === "https://oauth2.googleapis.com") {
        return Response.json({ access_token: "gmail-access", refresh_token: "gmail-refresh", expires_in: 3600, token_type: "Bearer", scope: "https://www.googleapis.com/auth/gmail.metadata" });
      }
      return Response.json({
        error: { code: 403, message: "Gmail API has not been used in project 999 before or it is disabled.", errors: [{ reason: "accessNotConfigured" }], status: "PERMISSION_DENIED" },
        access_token: "ya29.super-secret-token", refresh_token: "1//refresh-secret",
      }, { status: 403 });
    }) as typeof fetch;
    const failed = await callback(blocked.state);
    const failedLocation = new URL(failed.headers.get("location") || "");
    assert.match(failedLocation.searchParams.get("connectionError") || "", /Gmail: check the credential and required permissions/);
    assert.match(failedLocation.searchParams.get("connectionError") || "", /Gmail API is not enabled/);
    assert.equal((await runWithTenant("local", () => listConnections())).some((row: { name: string; status: string; config: { accountEmail?: string } }) => row.name === "Gmail" && row.status === "connected" && !row.config.accountEmail), false);
    const diagnostic = logged.find(entry => String(entry[0]).includes("Gmail request failed"));
    assert.ok(diagnostic);
    assert.equal(diagnostic?.[1], 403);
    const body = JSON.stringify(diagnostic);
    assert.match(body, /accessNotConfigured|not been used/);
    assert.equal(body.includes("ya29.super-secret-token"), false);
    assert.equal(body.includes("1//refresh-secret"), false);
  } finally {
    console.error = originalError;
    global.fetch = original;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
  }
});

test("the mailbox migration is numbered after scorecards and creates the snippet table", () => {
  const sql = fs.readFileSync(path.join(process.cwd(), "migrations/0007_email_messages.sql"), "utf8");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS email_messages/);
  assert.match(sql, /snippet TEXT NOT NULL/);
  assert.doesNotMatch(sql, /body TEXT/i);
  assert.equal(fs.existsSync(path.join(process.cwd(), "migrations/0006_scorecards.sql")), true);
});

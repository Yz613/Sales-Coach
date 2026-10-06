import assert from "node:assert/strict";
import { test, after } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { assertSecureDeployment, assertMutationOrigin, boundedRequest, localDevelopmentAllowed, mfaRequired, sessionHasMfa, verifiedSessionOriginAllowed } from "./security-policy";
import { encryptRecording, decryptRecording } from "./revenue/security";
import { currentTenantId, runWithTenant, TenantRequiredError } from "./tenant";
import { publicGuestAuth, authRedirectPath, runWithAuth, type AuthUser } from "./auth";
import { isPublicAuthRoute, stripAppBasePath } from "./public-path";
import { consumeLimit } from "./security-rate-limit";
import { db } from "./db";
import { appSettings, auditEvents, calls } from "./db/schema";
import { readCallAudio } from "./callAudioStore";
import { getAllSettings, getOrCreateRep, getSetting, setSetting, setGlobalSetting } from "./db/service";
import { openSetting } from "./setting-secrets";
import { claimPendingCheckout, originFromRequest } from "./stripeCheckout";
import { resolveUploadRepId } from "./viewer-calls";
import { withWorkspaceApi, workspaceErrorResponse } from "./workspace";
import { eq } from "drizzle-orm";
import { loadBillingAccount, recordEvaluationUsage } from "./billingQuota";

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sales-security-"));
process.env.SALES_COACH_DB_PATH = path.join(directory, "test.db");
process.env.CALL_AUDIO_DIR = path.join(directory, "audio");
process.env.INTEGRATION_ENCRYPTION_KEY = randomBytes(32).toString("base64");
after(() => fs.rmSync(directory, { recursive: true, force: true }));

const admin: AuthUser = { userId: "user_admin", role: "admin", isAdmin: true, isMember: false, isClerkConfigured: true, orgId: "org_secure", tenantId: "org_secure", orgRole: "org:admin", hasOrgAdmin: true, email: "admin@example.com", canViewAllCalls: true, clerkPlanId: null, billingPaid: true };
const member: AuthUser = { ...admin, userId: "user_member", role: "member", isAdmin: false, isMember: true, orgRole: "org:member", hasOrgAdmin: false, email: "member@example.com", canViewAllCalls: false };
const request = (path: string, init?: RequestInit) => new Request(`http://localhost/app${path}`, init);

test("operator payment exemptions retain tenant isolation and never accrue overage charges", async () => {
  const previous = { exempt: process.env.BILLING_EXEMPT_ORG_IDS, billing: process.env.BILLING_REQUIRED };
  try {
    process.env.BILLING_EXEMPT_ORG_IDS = "org_comped";
    process.env.BILLING_REQUIRED = "true";
    await runWithTenant("org_comped", async () => {
      const auth = { isClerkConfigured: true, orgId: "org_comped" };
      const account = await loadBillingAccount(auth);
      assert.equal(account.paid, true);
      assert.equal(account.unlimited, true);
      assert.equal(account.scope, "org_comped");
      assert.equal(account.overageOptIn, false);
      assert.equal((await recordEvaluationUsage(auth, 10000)).overageAmountUsd, 0);
      // A comped test account has the same verified admin guards as a paid team.
      const endpoint = withWorkspaceApi(async (_request: Request) => Response.json({ tenant: currentTenantId() }), { admin: true });
      const testAdmin = { ...admin, orgId: "org_comped", tenantId: "org_comped", mfaVerified: true, billingPaid: account.paid };
      const allowed = await runWithAuth(testAdmin, () => endpoint(request("/api/integrations")));
      assert.equal(allowed.status, 200);
      assert.deepEqual(await allowed.json(), { tenant: "org_comped" });
      const denied = await runWithAuth({ ...testAdmin, role: "member", isAdmin: false }, () => endpoint(request("/api/integrations")));
      assert.equal(denied.status, 403);
    });
    await runWithTenant("org_unpaid", async () => {
      const account = await loadBillingAccount({ isClerkConfigured: true, orgId: "org_unpaid" });
      assert.equal(account.paid, false);
      assert.equal(account.scope, "org_unpaid");
      assert.equal(account.usage.creditsUsed, 0);
    });
  } finally {
    if (previous.exempt === undefined) delete process.env.BILLING_EXEMPT_ORG_IDS; else process.env.BILLING_EXEMPT_ORG_IDS = previous.exempt;
    if (previous.billing === undefined) delete process.env.BILLING_REQUIRED; else process.env.BILLING_REQUIRED = previous.billing;
  }
});

test("verified Clerk sessions tolerate omitted azp but reject foreign or malformed origins", () => {
  assert.equal(verifiedSessionOriginAllowed({ sub: "user_verified", azp: "https://refreshqueue.com" }, "https://refreshqueue.com"), true);
  assert.equal(verifiedSessionOriginAllowed({ sub: "user_verified" }, "https://refreshqueue.com"), true);
  for (const azp of ["https://attacker.example", "https://refreshqueue.com.attacker.example", null, "", 42]) {
    assert.equal(verifiedSessionOriginAllowed({ azp }, "https://refreshqueue.com"), false);
  }
  assert.equal(verifiedSessionOriginAllowed(undefined, "https://refreshqueue.com"), false);
  assert.equal(verifiedSessionOriginAllowed({}, null), false);
});

test("authentication failures land on public session recovery instead of cycling through sign-in", () => {
  for (const authenticationIssue of ["invalid-origin", "unavailable"] as const) {
    const dest = authRedirectPath({ ...publicGuestAuth(), authenticationIssue });
    assert.equal(dest, "/app/session-recovery");
    assert.equal(isPublicAuthRoute(dest!), true);
    assert.equal(stripAppBasePath(dest!), "/session-recovery");
  }
});

test("production fails closed with incomplete security settings and unscoped work", async () => {
  const previous = process.env.NODE_ENV;
  try {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    assert.equal(localDevelopmentAllowed({ NODE_ENV: "production" }), false);
    assert.throws(() => assertSecureDeployment({ NODE_ENV: "production" }), /configuration/);
    assert.throws(() => currentTenantId(), TenantRequiredError);
    assert.equal(publicGuestAuth().isAdmin, false);
    let called = false;
    const guarded = withWorkspaceApi(async (_request: Request) => { called = true; return Response.json({ ok: true }); });
    const response = await guarded(request("/api/admin/settings", { headers: { "x-sc-auth": "1", "x-sc-org-id": "org_victim", "x-sc-org-admin": "1", "x-sc-user-id": "user_admin", "x-middleware-subrequest": "middleware:middleware:middleware:middleware:middleware" } }));
    assert.equal(response.status, 503);
    assert.equal(called, false);
    assertSecureDeployment({ NODE_ENV: "production", NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test", CLERK_SECRET_KEY: "sk_test", PUBLIC_APP_URL: "https://example.com", INTEGRATION_ENCRYPTION_KEY: randomBytes(32).toString("base64") });
  } finally { if (previous === undefined) delete (process.env as Record<string, string | undefined>).NODE_ENV; else (process.env as Record<string, string | undefined>).NODE_ENV = previous; }
});

test("production MFA policy rejects absent, unverified, and stale second factors", async () => {
  assert.equal(mfaRequired({ NODE_ENV: "production" }), true);
  assert.equal(sessionHasMfa({ fva: [0, 0] }), true);
  for (const fva of [undefined, [0, -1], [0, 481], [0, "0"], [0, Infinity]]) assert.equal(sessionHasMfa({ fva }), false);
  const previous = process.env.REQUIRE_MFA;
  try {
    process.env.REQUIRE_MFA = "true";
    const endpoint = withWorkspaceApi(async (_req: Request) => Response.json({ ok: true }));
    assert.equal((await runWithAuth(member, () => endpoint(request("/api/probe")))).status, 403);
    assert.equal((await runWithAuth({ ...member, mfaVerified: true }, () => endpoint(request("/api/probe")))).status, 200);
  } finally { if (previous === undefined) delete process.env.REQUIRE_MFA; else process.env.REQUIRE_MFA = previous; }
});

test("encrypted recordings reject tampering and swapping across workspaces or calls", () => {
  const audio = Buffer.from("private call recording");
  const encrypted = encryptRecording(audio, "org_a:call_1");
  assert.ok(!encrypted.includes(audio));
  assert.deepEqual(decryptRecording(encrypted, "org_a:call_1"), audio);
  assert.throws(() => decryptRecording(encrypted, "org_b:call_1"));
  assert.throws(() => decryptRecording(encrypted, "org_a:call_2"));
  const corrupted = Buffer.from(encrypted); corrupted[corrupted.length - 1] ^= 1;
  assert.throws(() => decryptRecording(corrupted, "org_a:call_1"));
});

test("server admin guards protect actual settings, rep, coach, and job routes without middleware", async () => {
  const routes = [await import("../app/api/admin/settings/route"), await import("../app/api/reps/[id]/route"), await import("../app/api/coach/route"), await import("../app/api/jobs/route")];
  for (const route of routes) {
    const response = await runWithAuth(member, () => (route.GET as any)(request("/api/probe")));
    assert.equal(response.status, 403);
    assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
  }
  const endpoint = withWorkspaceApi(async (_request: Request) => Response.json({ tenant: currentTenantId() }));
  await Promise.all(["org_one", "org_two"].map(org => runWithAuth({ ...admin, tenantId: org, orgId: org }, async () => {
    const response = await endpoint(request("/api/probe"));
    assert.equal((await response.json()).tenant, org);
  })));
  const repsRoute = await import("../app/api/reps/route");
  const repsResponse = await runWithAuth(member, () => (repsRoute.GET as any)(request("/api/reps")));
  assert.equal(repsResponse.status, 200);
});

test("cross-origin writes and chunked oversized bodies are rejected before business logic", async () => {
  assert.throws(() => assertMutationOrigin(request("/api/probe", { method: "POST", headers: { origin: "https://attacker.example" } }), { NODE_ENV: "development" }), /Cross-origin/);
  assert.throws(() => assertMutationOrigin(request("/api/probe", { method: "DELETE", headers: { "sec-fetch-site": "cross-site" } })), /Cross-origin/);
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(12)); controller.enqueue(new Uint8Array(12)); controller.close(); } });
  await assert.rejects(() => boundedRequest(request("/api/probe", { method: "POST", body: stream, duplex: "half" } as RequestInit), 20), /too large/);
  const bounded = await boundedRequest(request("/api/probe", { method: "POST", body: '{"ok":true}' }), 20);
  assert.deepEqual(await bounded.json(), { ok: true });
  let called = false;
  const endpoint = withWorkspaceApi(async (_request: Request) => { called = true; return Response.json({ ok: true }); });
  assert.equal((await runWithAuth(admin, () => endpoint(request("/api/probe", { method: "POST", headers: { origin: "https://attacker.example" } })))).status, 403);
  assert.equal(called, false);
});

test("distributed counters atomically enforce a shared budget and reset next window", async () => {
  const now = Date.now();
  const results = await Promise.allSettled(Array.from({ length: 12 }, () => consumeLimit("security-concurrency", 4, 60_000, now)));
  assert.equal(results.filter(r => r.status === "fulfilled").length, 4);
  assert.equal(results.filter(r => r.status === "rejected" && (r.reason as any).status === 429).length, 8);
  await consumeLimit("security-concurrency", 4, 60_000, now + 60_000);
});

test("settings are encrypted at rest, isolated by authenticated context, and legacy plaintext is upgraded", async () => {
  process.env.INTEGRATION_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  await runWithTenant("org_secure", async () => {
    await setSetting("ai_api_key", "secret-provider-credential");
    const key = "t:org_secure:ai_api_key";
    const row = await db.select().from(appSettings).where(eq(appSettings.key, key)).get();
    assert.ok(row.value.startsWith("v1."));
    assert.ok(!row.value.includes("secret-provider-credential"));
    assert.throws(() => openSetting("t:org_other:ai_api_key", row.value));
    assert.equal(await getSetting("ai_api_key"), "secret-provider-credential");
    assert.equal((await getAllSettings()).ai_api_key, "secret-provider-credential");
    await db.insert(appSettings).values({ key: "t:org_secure:resend_api_key", value: "legacy-secret", updatedAt: new Date().toISOString() }).run();
    assert.equal(await getSetting("resend_api_key"), "legacy-secret");
    const upgraded = await db.select().from(appSettings).where(eq(appSettings.key, "t:org_secure:resend_api_key")).get();
    assert.ok(upgraded.value.startsWith("v1."));
  });
  assert.equal(await runWithTenant("org_other", () => getSetting("ai_api_key")), null);
});

test("the settings API saves keys, reloads them, and preserves existing keys when fields are blank", async () => {
  const route = await import("../app/api/admin/settings/route");
  const org = "org_settings_save";
  const settingsAdmin = { ...admin, orgId: org, tenantId: org };
  const save = (body: Record<string, unknown>) => runWithAuth(settingsAdmin, () => route.POST(request("/api/admin/settings", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  })));
  const first = await save({ provider: "gemini", apiKey: "sk-test-settings-fixture-1234", activeModel: "gpt-4.1-mini", resendApiKey: "re_mail-fixture-5678", overageOptIn: false });
  assert.equal(first.status, 200);
  assert.equal((await first.json()).success, true);
  const reload = await runWithAuth(settingsAdmin, () => (route.GET as any)(request("/api/admin/settings")));
  assert.equal(reload.status, 200);
  const data = await reload.json();
  assert.equal(data.hasKey, true);
  assert.equal(data.provider, "openai");
  assert.equal(data.activeModel, "gpt-4.1-mini");
  assert.equal(data.hasResendKey, true);
  assert.ok(!JSON.stringify(data).includes("settings-fixture"));
  assert.ok(!JSON.stringify(data).includes("mail-fixture"));
  assert.equal((await save({ provider: "openai", activeModel: "gpt-4.1-mini", apiKey: "", resendApiKey: "" })).status, 200);
  await runWithTenant(org, async () => {
    assert.equal(await getSetting("ai_api_key"), "sk-test-settings-fixture-1234");
    assert.equal(await getSetting("resend_api_key"), "re_mail-fixture-5678");
    const rows = await db.select().from(appSettings).all();
    for (const key of ["ai_api_key", "resend_api_key"]) {
      assert.ok(rows.find((row: any) => row.key === `t:${org}:${key}`).value.startsWith("v1."));
    }
  });
  assert.equal(await runWithTenant("org_settings_other", () => getSetting("ai_api_key")), null);
  const denied = await runWithAuth({ ...settingsAdmin, isAdmin: false, role: "member" }, () => route.POST(request("/api/admin/settings", { method: "POST", body: JSON.stringify({ apiKey: "unauthorized" }) })));
  assert.equal(denied.status, 403);
});

test("uploading under another rep's display name cannot steal their identity", async () => {
  await runWithTenant("org_secure", async () => {
    const victim = await getOrCreateRep(undefined, "Victim", undefined, "victim@example.com");
    const attacker = await resolveUploadRepId({ ...member, name: "Victim" }, { repId: victim, repName: "Victim" });
    assert.notEqual(attacker, victim);
    await assert.rejects(() => resolveUploadRepId({ ...member, email: undefined, name: "Victim" }, { repId: victim }), /Verify/);
  });
});

test("retired global configuration endpoints have no side effects and errors hide secrets", async () => {
  for (const route of [await import("../app/api/auth/revoke-leaked-session/route"), await import("../app/api/auth/clerk-proxy/route"), await import("../app/api/billing/stripe-config/route")]) {
    assert.equal((await (route.POST as any)(request("/api/probe", { method: "POST", body: "{}" }))).status, 410);
  }
  const error = await workspaceErrorResponse(new Error("SQL failure /private/data sk_live_SECRET")).json();
  assert.ok(!JSON.stringify(error).includes("SECRET"));
  const req = request("/checkout/success", { headers: { "x-forwarded-host": "attacker.example", "x-forwarded-proto": "http" } });
  assert.equal(originFromRequest(req), "http://localhost");
});

test("checkout claims require the payer's verified email and cannot race between organizations", async () => {
  const sessionId = `cs_secure_${Date.now()}`;
  const record = { sessionId, planId: "coach", status: "paid", email: "payer@example.com", updatedAt: new Date().toISOString() };
  await setGlobalSetting(`stripe:session:${sessionId}`, JSON.stringify(record));
  assert.equal(await claimPendingCheckout({ sessionId, orgId: "org_thief", email: "thief@example.com" }), null);
  const claims = await Promise.all(["org_a", "org_b"].map(orgId => claimPendingCheckout({ sessionId, orgId, email: "payer@example.com" })));
  assert.equal(claims.filter(Boolean).length, 1);
});

test("payment links open Stripe or return a safe pricing notice without leaking provider errors", async () => {
  const checkout = await import("../app/api/billing/checkout/route");
  const previous = process.env.STRIPE_SECRET_KEY;
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  const diagnostics: string[] = [];
  console.warn = (...args) => { diagnostics.push(args.join(" ")); };
  try {
    delete process.env.STRIPE_SECRET_KEY;
    const missing = await runWithAuth(publicGuestAuth(), () => checkout.GET(request("/api/billing/checkout?plan=coach")));
    assert.equal(missing.status, 303);
    const target = new URL(missing.headers.get("location")!);
    assert.equal(target.hash, "#pricing");
    assert.equal(target.searchParams.get("checkout_error"), "configuration");

    process.env.STRIPE_SECRET_KEY = "sk_test_private_payment_key";
    globalThis.fetch = async (input, options) => {
      assert.equal(String(input), "https://api.stripe.com/v1/checkout/sessions");
      assert.equal(options?.method, "POST");
      assert.equal(options?.redirect, "manual");
      assert.equal(new URLSearchParams(String(options?.body)).get("metadata[plan]"), "team");
      return Response.json({ id: "cs_fixture", url: "https://checkout.stripe.com/c/pay/cs_fixture" });
    };
    const success = await runWithAuth(publicGuestAuth(), () => checkout.GET(request("/api/billing/checkout?plan=team")));
    assert.equal(success.status, 303);
    assert.equal(success.headers.get("location"), "https://checkout.stripe.com/c/pay/cs_fixture");

    for (const method of ["GET", "POST"] as const) {
      globalThis.fetch = async () => Response.json({ error: { message: "sk_test_private_payment_key buyer@example.com", code: "api_key_expired" } }, { status: 401 });
      const rejected = await runWithAuth(publicGuestAuth(), () => checkout[method](request("/api/billing/checkout?plan=coach", { method })));
      assert.equal(rejected.status, 303);
      assert.equal(new URL(rejected.headers.get("location")!).searchParams.get("checkout_error"), "configuration");
      assert.equal(rejected.headers.get("cache-control"), "private, no-store, max-age=0");
    }
    globalThis.fetch = async () => Response.json({ id: "cs_no_url" });
    const malformed = await runWithAuth(publicGuestAuth(), () => checkout.GET(request("/api/billing/checkout?plan=coach")));
    assert.equal(new URL(malformed.headers.get("location")!).searchParams.get("checkout_error"), "failed");
    assert.ok(diagnostics.some(line => line.includes("api_key_expired")));
    assert.ok(!diagnostics.join(" ").includes("private_payment_key"));
    assert.ok(!diagnostics.join(" ").includes("buyer@example.com"));
  } finally {
    if (previous === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = previous;
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
  }
});


test("successful writes retain a tenant-scoped audit trail without secret bodies", async () => {
  const endpoint = withWorkspaceApi(async (_req: Request) => Response.json({ ok: true }));
  const response = await runWithAuth(admin, () => endpoint(request("/api/admin/settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ apiKey: "never-log-this-secret" }) })));
  assert.equal(response.status, 200);
  const rows = await db.select().from(auditEvents).where(eq(auditEvents.orgId, "org_secure")).all();
  assert.ok(rows.some((row: any) => row.actor === admin.userId && row.action === "api.post"));
  assert.ok(!JSON.stringify(rows).includes("never-log-this-secret"));
});

test("the operator migration encrypts legacy media/settings and removes the old plaintext recording", async () => {
  await runWithTenant("local", async () => {
    const repId = await getOrCreateRep(undefined, "Migration Rep", undefined, "migration@example.com");
    await db.insert(calls).values({ id: "call_migration", orgId: "local", repId, prospectCompany: "", prospectName: "Prospect", callStage: "Cold Call", coreOutcome: "Dropped", durationSeconds: 60, transcriptText: "Rep: Hello. Prospect: Goodbye.", audioUrl: "/api/calls/call_migration/audio", status: "completed", createdAt: new Date().toISOString() }).run();
    await db.insert(appSettings).values({ key: "t:local:gemini_api_key", value: "legacy-provider-secret", updatedAt: new Date().toISOString() }).run();
    const audioDir = process.env.CALL_AUDIO_DIR!;
    fs.mkdirSync(audioDir, { recursive: true });
    const audio = Buffer.from("legacy recording payload");
    fs.writeFileSync(path.join(audioDir, "call_migration.mp3"), audio);
    fs.writeFileSync(path.join(audioDir, "call_migration.meta.json"), JSON.stringify({ mimeType: "audio/mpeg", fileName: "legacy.mp3", ext: ".mp3" }));
    const migration = spawnSync(process.execPath, ["--import", "tsx", "scripts/encrypt-stored-data.ts"], { cwd: process.cwd(), env: { ...process.env }, encoding: "utf8" });
    assert.equal(migration.status, 0, migration.stderr);
    assert.ok(!migration.stdout.includes("legacy-provider-secret"));
    assert.equal(fs.existsSync(path.join(audioDir, "call_migration.mp3")), false);
    assert.deepEqual((await readCallAudio("call_migration"))?.bytes, audio);
    const row = await db.select().from(appSettings).where(eq(appSettings.key, "t:local:gemini_api_key")).get();
    assert.ok(row.value.startsWith("v1."));
    assert.equal(await getSetting("gemini_api_key"), "legacy-provider-secret");
  });
});

test("batch upload preserves successful calls and reports failures separately", async () => {
  const { POST } = await import("../app/api/calls/batch-upload/route");
  const previousBilling = process.env.BILLING_REQUIRED;
  process.env.BILLING_REQUIRED = "false";
  try {
    assert.ok(admin.tenantId);
    const repId = await runWithTenant(admin.tenantId, () => getOrCreateRep(undefined, "Batch regression", "AE", "batch@example.com"));
    const response = await runWithAuth(admin, () => POST(request("/api/calls/batch-upload", {
      method: "POST", headers: { "content-type": "application/json", origin: "http://localhost" },
      body: JSON.stringify({ calls: [
        { repId, transcriptText: "Rep: Hello there.\nBuyer: Please send the proposal.", prospectCompany: 42 },
        { repId, transcriptText: "Rep: Hello there.\nBuyer: Please send the proposal.", prospectCompany: "Batch Co", callStage: "Cold Call" },
      ] }),
    })));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.processedCount, 1);
    assert.equal(body.failedCount, 1);
    assert.equal(body.results.length, 2);
    assert.match(body.results[0].error, /Failed to process call/);
    const saved = await db.select().from(calls).where(eq(calls.id, body.results[1].callId)).get();
    assert.equal(saved.status, "completed");
  } finally {
    if (previousBilling === undefined) delete process.env.BILLING_REQUIRED; else process.env.BILLING_REQUIRED = previousBilling;
  }
});

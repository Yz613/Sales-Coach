import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { buildHubspotProperties, canonicalProperties, parsePropertyMappings } from "./hubspot-properties";
import { normalizedMeeting } from "./meeting";
import { emptyPlaybook } from "../revenue/forecast-model";

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sales-hubspot-properties-"));
process.env.SALES_COACH_DB_PATH = path.join(directory, "test.db");
process.env.INTEGRATION_ENCRYPTION_KEY = randomBytes(32).toString("base64");
process.env.PUBLIC_APP_URL = "https://coach.example.com";
after(() => fs.rmSync(directory, { recursive: true, force: true }));
const now = new Date().toISOString();
const mappings = [
  { source: "summary" as const, object: "deal" as const, property: "coaching_summary" },
  { source: "score" as const, object: "deal" as const, property: "coaching_score" },
  { source: "nextSteps" as const, object: "deal" as const, property: "coaching_next_steps" },
  { source: "forecastCategory" as const, object: "deal" as const, property: "hs_manual_forecast_category" },
  { source: "summary" as const, object: "contact" as const, property: "coaching_summary" },
  { source: "score" as const, object: "contact" as const, property: "coaching_score" },
  { source: "nextSteps" as const, object: "contact" as const, property: "coaching_next_steps" },
];
let failure = 0; let malformed = false;
const requests: { url: URL; init?: RequestInit; body: any }[] = [];
async function vendorFetch(input: any, init?: RequestInit) {
  const url = new URL(String(input)); const body = init?.body ? JSON.parse(String(init.body)) : null;
  requests.push({ url, init, body });
  assert.equal(init?.redirect, "manual");
  assert.equal(init?.method, "PATCH");
  assert.equal(url.hostname, "api.hubapi.com");
  assert.match(url.pathname, /^\/crm\/v3\/objects\/(deals|contacts)\/\d+$/);
  assert.equal((init?.headers as any).Authorization, "Bearer hubspot-token-a");
  assert.equal(JSON.stringify(body).includes("hubspot-token-a"), false);
  if (failure) return new Response("vendor error never logged", { status: failure, headers: failure === 429 ? { "Retry-After": "120" } : {} });
  if (malformed) return Response.json({});
  return Response.json({ id: url.pathname.split("/").pop() });
}
async function withVendors(fn: () => Promise<void>) {
  const original = global.fetch; global.fetch = vendorFetch; failure = 0; malformed = false; requests.length = 0;
  try { await fn(); } finally { global.fetch = original; }
}
async function seedConnection(orgId: string, provider = "hubspot", config = {}) {
  const { db, ensureRevenueSchema } = await import("../db"); const { integrationConnections } = await import("../db/schema"); const { encryptCredentials } = await import("../revenue/security");
  await ensureRevenueSchema(); const id = `${orgId}-${provider}`;
  await db.insert(integrationConnections).values({ id, orgId, provider, name: provider, credentials: encryptCredentials({ token: "hubspot-token-a" }, `${orgId}:${id}`), config: JSON.stringify({ autoSync: false, autoEvaluate: false, defaultStage: "First Discovery", ...config }), createdAt: now, updatedAt: now }).run();
  return id;
}
async function seedCall(label: string) {
  const { importMeeting } = await import("../revenue/imports");
  return (await importMeeting({ id: "fixture-call-source", provider: "fathom", config: { defaultStage: "First Discovery" } }, normalizedMeeting({ externalId: label, title: `Discovery ${label}`, repName: "Alex", repEmail: "alex@company.com", transcriptText: "Alex: What is your budget?", summary: '<script>alert("x")</script> Budget confirmed', actionItems: [{ id: "action", description: "Send proposal", completed: false }] }))).callId;
}
async function seedScore(callId: string, score: number, bottomLine = "Coach the budget question") {
  const { db } = await import("../db"); const { calls, evaluations } = await import("../db/schema");
  const call = await db.select().from(calls).where(eq(calls.id, callId)).get();
  await db.insert(evaluations).values({ id: `ev-${callId}`, orgId: call.orgId, callId, repId: call.repId, bottomLine, painStatus: "Pass", painEvidence: "", budgetStatus: "Pass", budgetEvidence: "", decisionStatus: "Pass", decisionEvidence: "", scriptAdherenceScore: score, scriptFeedback: "", missedOpportunities: "[]", topFixes: "[]", createdAt: now }).onConflictDoUpdate({ target: evaluations.id, set: { scriptAdherenceScore: score, bottomLine } }).run();
}
async function seedTarget(connectionId: string, callId: string, kind = "deal") {
  const { db } = await import("../db"); const { crmRecords, callMetadata } = await import("../db/schema"); const { currentTenantId } = await import("../tenant");
  const orgId = currentTenantId(); const id = `${connectionId}-${kind}`;
  await db.insert(crmRecords).values({ id, orgId, connectionId, provider: "hubspot", externalId: kind === "deal" ? "123" : kind === "contact" ? "124" : "125", kind, name: "Acme", stage: "Qualified", amount: "5000", currency: "USD", syncedAt: now }).onConflictDoNothing().run();
  const meta = await db.select().from(callMetadata).where(eq(callMetadata.callId, callId)).get();
  const ids = JSON.parse(meta.crmRecordIds);
  if (!ids.includes(id)) await db.update(callMetadata).set({ crmRecordIds: JSON.stringify([...ids, id]) }).where(eq(callMetadata.callId, callId)).run();
  return id;
}
async function drain(orgId: string) {
  const { processJobs } = await import("../revenue/jobs");
  for (let i = 0; i < 30; i++) if (!(await Promise.all([1, 2, 3, 4].map(() => processJobs(orgId, 10)))).flat().length) return;
  throw new Error("Jobs did not drain");
}
const patches = () => requests.filter(request => request.init?.method === "PATCH");

test("property mappings accept coaching fields and reject unsafe or duplicate targets", () => {
  assert.equal(parsePropertyMappings(null).length, 0);
  assert.deepEqual(parsePropertyMappings(mappings).map(mapping => mapping.property), ["coaching_summary", "coaching_score", "coaching_next_steps", "hs_manual_forecast_category", "coaching_summary", "coaching_score", "coaching_next_steps"]);
  for (const value of [
    [{ source: "forecastCategory", object: "contact", property: "forecast" }],
    [{ source: "summary", object: "company", property: "description" }],
    [{ source: "summary", object: "deal", property: "dealname" }],
    [{ source: "summary", object: "contact", property: "email" }],
    [{ source: "summary", object: "deal", property: "Coaching Summary" }],
    [{ source: "notes", object: "deal", property: "description" }],
    [...mappings, { source: "summary", object: "deal", property: "another_summary" }],
    Array.from({ length: 9 }, () => ({ source: "summary", object: "deal", property: "coaching_summary" })),
  ]) assert.throws(() => parsePropertyMappings(value));
  const custom = buildHubspotProperties({ mappings: [{ source: "forecastCategory", object: "deal", property: "coaching_forecast" }], object: "deal", forecastCategory: "commit" });
  const native = buildHubspotProperties({ mappings: [{ source: "forecastCategory", object: "deal", property: "hs_manual_forecast_category" }], object: "deal", forecastCategory: "best_case" });
  assert.equal(custom.properties.coaching_forecast, "Commit");
  assert.equal(native.properties.hs_manual_forecast_category, "BEST_CASE");
  const payload = buildHubspotProperties({ mappings, object: "deal", summary: "  Coach the budget question  ", score: 8, nextSteps: "Open: Send proposal", forecastCategory: "commit" });
  assert.deepEqual(payload.properties, { coaching_next_steps: "Open: Send proposal", coaching_score: "8", coaching_summary: "Coach the budget question", hs_manual_forecast_category: "COMMIT" });
  assert.equal(canonicalProperties({ b: "2", a: "1" }).hash, canonicalProperties({ a: "1", b: "2" }).hash);
  assert.equal(buildHubspotProperties({ mappings, object: "contact", summary: "Coach", score: 11, nextSteps: "", forecastCategory: "commit" }).properties.coaching_score, undefined);
  assert.equal(buildHubspotProperties({ mappings: [{ source: "summary", object: "deal", property: "coaching_summary" }], object: "deal", summary: "x".repeat(70000) }).properties.coaching_summary.length, 65000);
  assert.equal(Object.keys(buildHubspotProperties({ mappings, object: "contact", forecastCategory: "commit" }).properties).length, 0);
});

test("reviewed calls update mapped HubSpot deal and contact properties once", async () => withVendors(async () => {
  const { runWithTenant } = await import("../tenant"); const { queueIntegrationEvents } = await import("../revenue/exports");
  const { saveConnectionConfig, getConnection } = await import("../revenue/connections"); const { db } = await import("../db");
  const { callMetadata, crmPropertyWrites, dealReviews } = await import("../db/schema");
  await runWithTenant("org-props", async () => {
    const id = await seedConnection("org-props"); const pipedrive = await seedConnection("org-props", "pipedrive", { writePropertiesOnReview: true, propertyMappings: mappings });
    const callId = await seedCall("review"); await seedScore(callId, 8);
    const deal = await seedTarget(id, callId); const contact = await seedTarget(id, callId, "contact"); await seedTarget(id, callId, "company");
    await db.insert(dealReviews).values({ id: "review-props", orgId: "org-props", dealId: deal, category: "commit", probability: 70, nextStep: "Send contract", playbook: "{}", revision: 1, updatedBy: "admin", updatedAt: now }).run();
    const connection = await getConnection(id); await saveConnectionConfig(id, { ...connection.config, propertyMappings: mappings, writePropertiesOnReview: true });
    await db.update(callMetadata).set({ reviewedAt: now }).where(eq(callMetadata.callId, callId)).run();
    await Promise.all(Array.from({ length: 25 }, () => queueIntegrationEvents("call.reviewed", callId, now)));
    await drain("org-props");
    assert.equal(patches().length, 2);
    const dealPatch = patches().find(request => request.url.pathname.endsWith("/deals/123"))!;
    const contactPatch = patches().find(request => request.url.pathname.endsWith("/contacts/124"))!;
    assert.deepEqual(dealPatch.body.properties, { coaching_next_steps: "Open: Send proposal", coaching_score: "8", coaching_summary: "Coach the budget question", hs_manual_forecast_category: "COMMIT" });
    assert.equal(dealPatch.body.properties.coaching_summary.includes("<script>"), false);
    assert.deepEqual(contactPatch.body.properties, { coaching_next_steps: "Open: Send proposal", coaching_score: "8", coaching_summary: "Coach the budget question" });
    assert.equal(patches().some(request => request.url.pathname.includes("/companies/")), false);
    const rows = await db.select().from(crmPropertyWrites).where(eq(crmPropertyWrites.orgId, "org-props")).all();
    assert.equal(rows.length, 2); assert.ok(rows.every((row: any) => row.status === "completed" && row.connectionId === id));
    await queueIntegrationEvents("call.reviewed", callId, `${now}-again`); await drain("org-props");
    assert.equal(patches().length, 2);
    await runWithTenant("org-other", async () => {
      const { listPropertyWrites, queueManualPropertyWrite } = await import("../revenue/property-writes");
      assert.equal((await db.select().from(crmPropertyWrites).where(eq(crmPropertyWrites.orgId, "org-other")).all()).length, 0);
      await assert.rejects(() => listPropertyWrites(id), /not found/);
      await assert.rejects(() => queueManualPropertyWrite(id, callId, "admin", deal), /not found/);
      await assert.rejects(() => listPropertyWrites(pipedrive), /not found/);
    });
    assert.equal(contact, `${id}-contact`);
  });
}));

test("changed coaching values send one new update and stale deliveries send the latest value", async () => withVendors(async () => {
  const { runWithTenant } = await import("../tenant"); const { queueReviewedCallProperties } = await import("../revenue/property-writes");
  const { saveConnectionConfig, getConnection } = await import("../revenue/connections"); const { db } = await import("../db");
  const { callMetadata, evaluations } = await import("../db/schema"); const { processJobs } = await import("../revenue/jobs");
  await runWithTenant("org-props-stale", async () => {
    const id = await seedConnection("org-props-stale", "hubspot", { propertyMappings: [{ source: "score", object: "deal", property: "coaching_score" }], writePropertiesOnReview: true });
    const connection = await getConnection(id); await saveConnectionConfig(id, { ...connection.config, propertyMappings: [{ source: "score", object: "deal", property: "coaching_score" }], writePropertiesOnReview: true });
    const callId = await seedCall("stale"); await seedScore(callId, 8); const deal = await seedTarget(id, callId);
    await db.update(callMetadata).set({ reviewedAt: now }).where(eq(callMetadata.callId, callId)).run();
    const queued = await queueReviewedCallProperties(id, callId); assert.equal(queued.length, 1);
    await db.update(evaluations).set({ scriptAdherenceScore: 3 }).where(eq(evaluations.callId, callId)).run();
    await processJobs("org-props-stale", 1, [queued[0].jobId!]); assert.equal(patches().length, 0);
    await drain("org-props-stale"); assert.equal(patches().length, 1); assert.equal(patches()[0].body.properties.coaching_score, "3");
    await queueReviewedCallProperties(id, callId); await drain("org-props-stale"); assert.equal(patches().length, 1);
    await db.update(evaluations).set({ scriptAdherenceScore: 4 }).where(eq(evaluations.callId, callId)).run();
    await queueReviewedCallProperties(id, callId); await drain("org-props-stale"); assert.equal(patches().length, 2); assert.equal(patches().at(-1)!.body.properties.coaching_score, "4");
    assert.equal(deal, `${id}-deal`);
  });
}));

test("uncertain HubSpot property updates require confirmation, and revoked sources do not send", async () => withVendors(async () => {
  const { runWithTenant } = await import("../tenant"); const { queueReviewedCallProperties, listPropertyWrites, retryPropertyWrite } = await import("../revenue/property-writes");
  const { saveConnectionConfig, getConnection, disconnectIntegration } = await import("../revenue/connections");
  const { enqueueJob, processJobs } = await import("../revenue/jobs"); const { db } = await import("../db");
  const { callMetadata, crmPropertyWrites, processingJobs } = await import("../db/schema"); const { deleteConversation } = await import("../revenue/privacy");
  await runWithTenant("org-props-fail", async () => {
    const id = await seedConnection("org-props-fail"); const connection = await getConnection(id);
    await saveConnectionConfig(id, { ...connection.config, propertyMappings: [{ source: "summary", object: "deal", property: "coaching_summary" }], writePropertiesOnReview: true });
    const prepare = async (label: string) => {
      const live = await getConnection(id);
      await saveConnectionConfig(id, { ...live.config, propertyMappings: [{ source: "summary", object: "deal", property: "coaching_summary" }], writePropertiesOnReview: true });
      const callId = await seedCall(label); await seedScore(callId, 6, `Summary ${label}`); const target = await seedTarget(id, callId);
      await db.update(callMetadata).set({ reviewedAt: now }).where(eq(callMetadata.callId, callId)).run();
      const queued = await queueReviewedCallProperties(id, callId); assert.ok(queued[0]?.jobId, label); return { callId, target, queued: queued[0] };
    };
    for (const mode of [503, "malformed"] as const) {
      const row = await prepare(`uncertain-${mode}`); failure = mode === "malformed" ? 0 : mode; malformed = mode === "malformed"; const before = patches().length;
      assert.equal((await processJobs("org-props-fail", 1, [row.queued.jobId!]))[0].status, "failed"); failure = 0; malformed = false;
      assert.equal((await listPropertyWrites(id)).find((write: any) => write.id === row.queued.writeId)?.status, "uncertain");
      await enqueueJob({ kind: "write-crm-properties", connectionId: id, callId: row.callId, payload: { writeId: row.queued.writeId }, key: `replay-${mode}` });
      await drain("org-props-fail"); assert.equal(patches().length, before + 1);
      await assert.rejects(() => retryPropertyWrite(id, row.queued.writeId!, false, "admin"), /confirm/);
      const retry = await retryPropertyWrite(id, row.queued.writeId!, true, "admin"); await processJobs("org-props-fail", 1, [retry.jobId]);
      assert.equal(patches().length, before + 2); assert.equal(patches().at(-1)!.body.properties.coaching_summary, `Summary uncertain-${mode}`);
    }
    const denied = await prepare("denied"); failure = 403;
    assert.equal((await processJobs("org-props-fail", 1, [denied.queued.jobId!]))[0].status, "failed"); failure = 0;
    assert.equal((await listPropertyWrites(id)).find((write: any) => write.id === denied.queued.writeId)?.status, "failed");
    const limited = await prepare("limited"); failure = 429;
    assert.equal((await processJobs("org-props-fail", 1, [limited.queued.jobId!]))[0].status, "queued");
    const delayed = await db.select().from(processingJobs).where(eq(processingJobs.id, limited.queued.jobId!)).get();
    assert.ok(Date.parse(delayed.availableAt) >= Date.now() + 110000);
    failure = 0; await db.update(processingJobs).set({ availableAt: now }).where(eq(processingJobs.id, limited.queued.jobId!)).run();
    await processJobs("org-props-fail", 1, [limited.queued.jobId!]); assert.equal((await listPropertyWrites(id)).find((write: any) => write.id === limited.queued.writeId)?.status, "completed");
    const crashed = await prepare("crashed");
    await db.update(crmPropertyWrites).set({ status: "sending" }).where(eq(crmPropertyWrites.id, crashed.queued.writeId!)).run();
    const beforeCrash = patches().length;
    assert.equal((await processJobs("org-props-fail", 1, [crashed.queued.jobId!]))[0].status, "failed"); assert.equal(patches().length, beforeCrash);
    assert.equal((await listPropertyWrites(id)).find((write: any) => write.id === crashed.queued.writeId)?.canRetry, true);
    const crashRetry = await retryPropertyWrite(id, crashed.queued.writeId!, true, "admin"); await processJobs("org-props-fail", 1, [crashRetry.jobId]);
    assert.equal(patches().length, beforeCrash + 1);
    for (const revoke of ["unlink", "delete", "disable", "disconnect"] as const) {
      const row = await prepare(revoke); const before = patches().length;
      if (revoke === "unlink") await db.update(callMetadata).set({ crmRecordIds: "[]" }).where(eq(callMetadata.callId, row.callId)).run();
      if (revoke === "delete") await deleteConversation(row.callId, "admin");
      if (revoke === "disable") await saveConnectionConfig(id, { ...(await getConnection(id)).config, writePropertiesOnReview: false });
      if (revoke === "disconnect") await disconnectIntegration(id, "admin");
      await processJobs("org-props-fail", 1, [row.queued.jobId!]); assert.equal(patches().length, before);
      if (revoke === "unlink" || revoke === "disable") assert.equal((await db.select().from(crmPropertyWrites).where(eq(crmPropertyWrites.id, row.queued.writeId!)).get()).status, "cancelled");
    }
  });
}));

test("saving a deal forecast writes the mapped HubSpot category and ignores an unchanged probability", async () => withVendors(async () => {
  const { runWithTenant } = await import("../tenant"); const { saveDealReview } = await import("../revenue/forecast");
  const { saveConnectionConfig, getConnection } = await import("../revenue/connections"); const { db } = await import("../db");
  const { crmRecords } = await import("../db/schema");
  const auth = { userId: "manager", role: "admin" as const, isAdmin: true, isMember: false, isClerkConfigured: false, canViewAllCalls: true, tenantId: "org-props-forecast", clerkPlanId: null, billingPaid: true, name: "Manager" };
  await runWithTenant("org-props-forecast", async () => {
    const id = await seedConnection("org-props-forecast");
    await db.insert(crmRecords).values({ id: "forecast-deal", orgId: "org-props-forecast", connectionId: id, provider: "hubspot", externalId: "321", kind: "deal", name: "Acme", amount: "10000", currency: "USD", owner: "Alex", closeDate: "2026-12-15", stage: "Qualified", syncedAt: now }).run();
    const body = { category: "commit", probability: 80, nextStep: "Confirm purchase approval", nextStepDate: null, playbook: emptyPlaybook(), revision: 0 };
    await saveDealReview(auth, "forecast-deal", body); await drain("org-props-forecast"); assert.equal(patches().length, 0);
    const connection = await getConnection(id);
    await saveConnectionConfig(id, { ...connection.config, propertyMappings: [{ source: "forecastCategory", object: "deal", property: "hs_manual_forecast_category" }, { source: "summary", object: "deal", property: "coaching_summary" }], writePropertiesOnReview: true });
    await saveDealReview(auth, "forecast-deal", { ...body, revision: 1 }); await drain("org-props-forecast");
    assert.equal(patches().length, 1); assert.equal(patches()[0].url.pathname, "/crm/v3/objects/deals/321");
    assert.deepEqual(patches()[0].body.properties, { hs_manual_forecast_category: "COMMIT" });
    await saveDealReview(auth, "forecast-deal", { ...body, revision: 2, probability: 10 }); await drain("org-props-forecast");
    assert.equal(patches().length, 1);
    await saveDealReview(auth, "forecast-deal", { ...body, category: "best_case", revision: 3 }); await drain("org-props-forecast");
    assert.equal(patches().length, 2); assert.equal(patches()[1].body.properties.hs_manual_forecast_category, "BEST_CASE");
  });
}));

test("property endpoints reject members and other workspaces, and a manual update does not require the review opt-in", async () => withVendors(async () => {
  const { GET, POST } = await import("../../app/api/integrations/[id]/properties/route"); const { runWithAuth } = await import("../auth");
  const { runWithTenant } = await import("../tenant"); const { getConnection, saveConnectionConfig } = await import("../revenue/connections");
  const { db } = await import("../db"); const { callMetadata, evaluations } = await import("../db/schema"); const { queueManualPropertyWrite } = await import("../revenue/property-writes");
  const orgId = "org-props-api"; const id = `${orgId}-hubspot`; let callId = "";
  await runWithTenant(orgId, async () => {
    await seedConnection(orgId); const connection = await getConnection(id);
    await saveConnectionConfig(id, { ...connection.config, propertyMappings: [{ source: "score", object: "deal", property: "coaching_score" }], writePropertiesOnReview: false });
    callId = await seedCall("manual"); await seedScore(callId, 9, "Manual summary"); const target = await seedTarget(id, callId);
    await db.update(callMetadata).set({ reviewedAt: null }).where(eq(callMetadata.callId, callId)).run();
    const queued = await queueManualPropertyWrite(id, callId, "admin", target); await drain(orgId);
    assert.equal((await getConnection(id)).config.writePropertiesOnReview, false);
    assert.equal(patches().length, 1); assert.equal(patches()[0].body.properties.coaching_score, "9"); assert.equal(queued[0].writeId?.length, 64);
  });
  const auth: import("../auth").AuthUser = { userId: "admin", role: "admin", isAdmin: true, isMember: false, isClerkConfigured: true, orgId, tenantId: orgId, canViewAllCalls: true, clerkPlanId: null, billingPaid: true, mfaVerified: true };
  const member: import("../auth").AuthUser = { ...auth, userId: "member", role: "member", isAdmin: false, isMember: true };
  const context = { params: Promise.resolve({ id }) };
  const url = `http://localhost/app/api/integrations/${id}/properties`;
  const post = (user: import("../auth").AuthUser, body: unknown) => runWithAuth(user, () => POST(new Request(url, { method: "POST", headers: { "Content-Type": "application/json", origin: "https://coach.example.com" }, body: JSON.stringify(body) }), context));
  assert.equal((await runWithAuth(member, () => GET(new Request(url), context))).status, 403);
  assert.equal((await post(member, { action: "save", propertyMappings: mappings, writePropertiesOnReview: true })).status, 403);
  assert.equal((await post(member, { action: "write", callId: "any", targetId: "any" })).status, 403);
  assert.equal((await runWithAuth({ ...auth, orgId: "org-other", tenantId: "org-other" }, () => GET(new Request(url), context))).status, 404);
  assert.equal((await post(auth, { action: "save", propertyMappings: [{ source: "summary", object: "deal", property: "dealname" }], writePropertiesOnReview: true })).status, 400);
  const pipedriveContext = { params: Promise.resolve({ id: `${orgId}-pipedrive` }) };
  await runWithTenant(orgId, () => seedConnection(orgId, "pipedrive"));
  assert.equal((await runWithAuth(auth, () => POST(new Request(url.replace(id, `${orgId}-pipedrive`), { method: "POST", headers: { "Content-Type": "application/json", origin: "https://coach.example.com" }, body: JSON.stringify({ action: "save", propertyMappings: [{ source: "summary", object: "deal", property: "coaching_summary" }] }) }), pipedriveContext))).status, 400);
  const saved = await post(auth, { action: "save", propertyMappings: [{ source: "score", object: "deal", property: "coaching_score" }], writePropertiesOnReview: false });
  assert.equal(saved.status, 200);
  await runWithTenant(orgId, async () => assert.equal((await getConnection(id)).config.propertyMappings?.[0].property, "coaching_score"));
  await runWithTenant(orgId, () => db.update(evaluations).set({ scriptAdherenceScore: 5 }).where(eq(evaluations.callId, callId)).run());
  const before = patches().length;
  const sent = await post(auth, { action: "write", callId, targetId: `${id}-deal` });
  assert.equal(sent.status, 202); await drain(orgId); assert.equal(patches().length, before + 1); assert.equal(patches().at(-1)!.body.properties.coaching_score, "5");
  const repeat = await post(auth, { action: "write", callId, targetId: `${id}-deal` });
  assert.equal(repeat.status, 200); await drain(orgId); assert.equal(patches().length, before + 1);
}));

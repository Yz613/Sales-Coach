import { and, asc, desc, eq, inArray, lt, lte, ne, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db, ensureRevenueSchema } from "../db";
import { calls, crmRecords, integrationConnections, processingJobs } from "../db/schema";
import { currentTenantId, runWithTenant } from "../tenant";
import { getCallById } from "../db/service";
import { evaluateCall } from "../ai/coach";
import { evaluationCreditsForDuration } from "../billing";
import { assertEvaluationAllowed, recordEvaluationUsage } from "../billingQuota";
import { ProviderError } from "../integrations/http";
import { fathomPage, fathomRequest, normalizeFathomMeeting } from "../integrations/fathom";
import { hubspotPage } from "../integrations/hubspot";
import { getConnection } from "./connections";
import { importMeeting, importedCallId } from "./imports";
import { relinkConversations } from "./crm";
import { stableId, RevenueError } from "./security";
import { parseJson, type ImportedMeeting, type SyncCursor } from "./types";

type JobKind = "sync" | "import" | "transcript" | "evaluate";
export async function enqueueJob(input: { kind: JobKind; connectionId?: string; callId?: string; payload?: unknown; key: string }) {
  await ensureRevenueSchema();
  const orgId = currentTenantId(); const id = stableId("job", orgId, input.kind, input.key); const now = new Date().toISOString();
  await db.insert(processingJobs).values({ id, orgId, kind: input.kind, connectionId: input.connectionId, callId: input.callId,
    payload: JSON.stringify(input.payload || {}), status: "queued", availableAt: now, createdAt: now, updatedAt: now }).onConflictDoNothing().run();
  return id;
}

export async function enqueueSync(connectionId: string, full = false) {
  const connection = await getConnection(connectionId);
  const existing = await db.select({ id: processingJobs.id }).from(processingJobs).where(and(eq(processingJobs.orgId, currentTenantId()), eq(processingJobs.connectionId, connectionId), eq(processingJobs.kind, "sync"), inArray(processingJobs.status, ["queued", "running"]))).get();
  if (existing) return existing.id;
  const state: SyncCursor = { syncStartedAt: new Date().toISOString(), ...(connection.provider === "fathom" && !full && connection.lastSyncedAt ? { createdAfter: new Date(Date.parse(connection.lastSyncedAt) - 3600000).toISOString() } : {}) };
  return enqueueJob({ kind: "sync", connectionId, payload: state, key: `${connectionId}:${Math.floor(Date.now() / 60000)}:${full}` });
}

export async function listJobs() {
  return db.select({ id: processingJobs.id, kind: processingJobs.kind, connectionId: processingJobs.connectionId, callId: processingJobs.callId,
    status: processingJobs.status, attempts: processingJobs.attempts, result: processingJobs.result, lastError: processingJobs.lastError,
    createdAt: processingJobs.createdAt, availableAt: processingJobs.availableAt }).from(processingJobs).where(eq(processingJobs.orgId, currentTenantId())).orderBy(desc(processingJobs.createdAt)).limit(40).all();
}

export async function retryJob(id: string) {
  const updated = await db.update(processingJobs).set({ status: "queued", attempts: 0, lastError: null, availableAt: new Date().toISOString() })
    .where(and(eq(processingJobs.id, id), eq(processingJobs.orgId, currentTenantId()), eq(processingJobs.status, "failed"))).returning({ id: processingJobs.id }).all();
  if (!updated.length) throw new RevenueError("Failed job not found.", 404);
}

async function executeJob(job: any) {
  if (job.kind === "evaluate") {
    const call = await getCallById(job.callId);
    if (!call) return { skipped: "Call was deleted." };
    // A lease retry after successful evaluation must not bill or evaluate a second time.
    if (call.evaluation && call.status === "completed") return { alreadyEvaluated: true };
    const auth = { isClerkConfigured: job.orgId !== "local", orgId: job.orgId };
    const credits = evaluationCreditsForDuration(call.durationSeconds);
    await assertEvaluationAllowed(auth, credits);
    await db.update(calls).set({ status: "analyzing" }).where(and(eq(calls.id, call.id), eq(calls.orgId, job.orgId))).run();
    await evaluateCall({ ...call, callId: call.id });
    await recordEvaluationUsage(auth, credits);
    return { evaluated: call.id };
  }
  const connection = await getConnection(job.connectionId);
  if (job.kind === "import" || job.kind === "transcript") {
    let meeting: ImportedMeeting;
    if (job.kind === "transcript") {
      if (connection.provider !== "fathom") throw new RevenueError("Transcript job needs a Fathom connection.");
      const raw = parseJson<any>(job.payload, {});
      if (!/^\d+$/.test(String(raw.recording_id || ""))) throw new RevenueError("Invalid transcript recording ID.");
      const response = await fathomRequest<{ transcript: any[] }>(connection.secrets.token, `/recordings/${raw.recording_id}/transcript`);
      meeting = normalizeFathomMeeting({ ...raw, transcript: response.transcript });
    } else meeting = parseJson<ImportedMeeting>(job.payload, {} as ImportedMeeting);
    const result = await importMeeting(connection, meeting);
    if (!result.deleted && connection.config.autoEvaluate) await enqueueJob({ kind: "evaluate", connectionId: connection.id, callId: result.callId, key: result.callId });
    return result;
  }
  const state = parseJson<SyncCursor>(job.payload, {});
  await db.update(integrationConnections).set({ status: "syncing", lastError: null }).where(and(eq(integrationConnections.id, connection.id), eq(integrationConnections.orgId, job.orgId), ne(integrationConnections.status, "disconnected"))).run();
  let next: SyncCursor; let count = 0; let skipped = 0;
  if (connection.provider === "hubspot") {
    const page = await hubspotPage(connection.secrets.token, state, job.orgId, connection.id);
    await getConnection(connection.id);
    for (const record of page.records) {
      const values = { ...record, orgId: job.orgId, associations: JSON.stringify(record.associations), properties: JSON.stringify(record.properties) };
      await db.insert(crmRecords).values(values).onConflictDoUpdate({ target: crmRecords.id, set: values }).run();
    }
    count = page.records.length; next = page.next;
    if (next.complete && state.syncStartedAt) {
      await db.delete(crmRecords).where(and(eq(crmRecords.orgId, job.orgId), eq(crmRecords.connectionId, connection.id), lt(crmRecords.syncedAt, state.syncStartedAt))).run();
      await relinkConversations();
    }
  } else {
    const page = await fathomPage(connection.secrets.token, state);
    await getConnection(connection.id);
    for (const raw of page.deferred) {
      const callId = importedCallId(job.orgId, connection.id, String(raw.recording_id));
      await enqueueJob({ kind: "transcript", connectionId: connection.id, callId, payload: raw, key: `${job.id}:${raw.recording_id}` });
    }
    for (const meeting of page.meetings) {
      const result = await importMeeting(connection, meeting);
      if (!result.deleted && connection.config.autoEvaluate) await enqueueJob({ kind: "evaluate", connectionId: connection.id, callId: result.callId, key: result.callId });
      if (result.inserted) count++;
    }
    skipped = page.skipped;
    next = { ...state, after: page.next || undefined, complete: !page.next };
  }
  await db.update(integrationConnections).set({ cursor: JSON.stringify(next), status: next.complete ? "connected" : "syncing",
    ...(next.complete ? { lastSyncedAt: state.syncStartedAt || new Date().toISOString() } : {}), updatedAt: new Date().toISOString() }).where(and(eq(integrationConnections.id, connection.id), eq(integrationConnections.orgId, job.orgId), ne(integrationConnections.status, "disconnected"))).run();
  if (!next.complete) await enqueueJob({ kind: "sync", connectionId: connection.id, payload: next, key: `${job.id}:${JSON.stringify(next)}` });
  return { imported: count, skipped, complete: Boolean(next.complete) };
}

/** SQL compare-and-set leases keep manual workers, cron, and after() from processing the same job. */
export async function processJobs(orgId?: string, limit = 2) {
  await ensureRevenueSchema();
  const outcomes: { id: string; status: string }[] = [];
  const started = Date.now();
  for (let index = 0; index < Math.min(10, limit) && Date.now() - started < 45000; index++) {
    const now = new Date().toISOString();
    const ready = or(and(eq(processingJobs.status, "queued"), lte(processingJobs.availableAt, now)), and(eq(processingJobs.status, "running"), lte(processingJobs.leaseUntil, now)));
    const row = await db.select().from(processingJobs).where(and(ready, orgId ? eq(processingJobs.orgId, orgId) : undefined)).orderBy(asc(processingJobs.createdAt)).get();
    if (!row) break;
    const token = randomUUID();
    const claimed = await db.update(processingJobs).set({ status: "running", leaseToken: token, leaseUntil: new Date(Date.now() + 600000).toISOString(), attempts: sql`${processingJobs.attempts} + 1`, updatedAt: now })
      .where(and(eq(processingJobs.id, row.id), ready)).returning().all();
    if (!claimed.length) continue;
    const job = claimed[0];
    try {
      const result = await runWithTenant(job.orgId, () => executeJob(job));
      await db.update(processingJobs).set({ status: "completed", result: JSON.stringify(result), payload: "{}", leaseToken: null, leaseUntil: null, lastError: null, updatedAt: new Date().toISOString() }).where(and(eq(processingJobs.id, job.id), eq(processingJobs.leaseToken, token))).run();
      outcomes.push({ id: job.id, status: "completed" });
    } catch (err) {
      const permanent = (err instanceof ProviderError && [401, 403, 404].includes(err.providerStatus)) || (err as any)?.status === 402;
      const failed = permanent || job.attempts >= 5;
      const message = err instanceof RevenueError || (err as any)?.code === "QUOTA_EXCEEDED" || (err as any)?.code === "PAYMENT_REQUIRED" ? (err as Error).message : "Processing failed. Retry the job or check server diagnostics.";
      const delay = err instanceof ProviderError ? Math.max(err.retryAfterSeconds, 30 * 2 ** job.attempts) : 30 * 2 ** job.attempts;
      await db.update(processingJobs).set({ status: failed ? "failed" : "queued", lastError: message, leaseToken: null, leaseUntil: null, availableAt: new Date(Date.now() + Math.min(3600, delay) * 1000).toISOString(), updatedAt: new Date().toISOString() }).where(and(eq(processingJobs.id, job.id), eq(processingJobs.leaseToken, token))).run();
      if (job.kind === "evaluate") await db.update(calls).set({ status: "failed" }).where(and(eq(calls.id, job.callId), eq(calls.orgId, job.orgId))).run();
      if (job.connectionId) await db.update(integrationConnections).set({ status: "error", lastError: message }).where(and(eq(integrationConnections.id, job.connectionId), eq(integrationConnections.orgId, job.orgId), ne(integrationConnections.status, "disconnected"))).run();
      outcomes.push({ id: job.id, status: failed ? "failed" : "queued" });
    }
  }
  return outcomes;
}

export async function scheduleSyncs() {
  await ensureRevenueSchema();
  const connections = await db.select().from(integrationConnections).where(inArray(integrationConnections.status, ["connected", "error"])).all();
  for (const row of connections) {
    const config = parseJson<{ autoSync?: boolean }>(row.config, {});
    if (config.autoSync && (!row.lastSyncedAt || Date.now() - Date.parse(row.lastSyncedAt) > 900000)) {
      try { await runWithTenant(row.orgId, () => enqueueSync(row.id)); }
      catch { /* One unavailable connection must not stop other workspaces. */ }
    }
  }
}

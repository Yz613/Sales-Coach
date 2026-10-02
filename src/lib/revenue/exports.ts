import { and, desc, eq, inArray } from "drizzle-orm";
import { db, ensureRevenueSchema } from "../db";
import { callMetadata, crmRecords, integrationConnections, integrationExports, processingJobs } from "../db/schema";
import { getCallById } from "../db/service";
import { currentTenantId } from "../tenant";
import { audit, getConnection } from "./connections";
import { stableId, RevenueError } from "./security";
import { parseJson, type ActionItem, type ConnectionConfig } from "./types";
import { runtimeSecret } from "./runtime";
import { createCrmNote, sendAutomationEvent } from "../integrations/outbound";
import { ProviderError } from "../integrations/http";

export class ExportDeliveryError extends RevenueError { readonly nonRetryable = true; }
const isCrm = (provider: string) => ["hubspot", "pipedrive", "attio"].includes(provider);
const isAutomation = (provider: string) => ["zapier", "make"].includes(provider);

async function sourceCall(callId: string) {
  const call = await getCallById(callId); if (!call) throw new RevenueError("Call not found.", 404);
  const meta = await db.select().from(callMetadata).where(and(eq(callMetadata.orgId, currentTenantId()), eq(callMetadata.callId, callId))).get();
  return { call, meta };
}
async function linkedTarget(connectionId: string, callId: string, targetId: string) {
  const { meta } = await sourceCall(callId);
  if (!parseJson<string[]>(meta?.crmRecordIds, []).includes(targetId)) throw new RevenueError("Link this CRM record to the call before exporting.", 409);
  const target = await db.select().from(crmRecords).where(and(eq(crmRecords.orgId, currentTenantId()), eq(crmRecords.connectionId, connectionId), eq(crmRecords.id, targetId))).get();
  if (!target) throw new RevenueError("Linked CRM record not found. Sync the CRM again.", 404);
  return target;
}
export async function queueCallExport(connectionId: string, callId: string, actor: string, targetId?: string, event = "call.shared", eventKey = callId) {
  const connection = await getConnection(connectionId); await sourceCall(callId);
  if (isCrm(connection.provider)) {
    if (!targetId) throw new RevenueError("Choose a linked CRM record.");
    await linkedTarget(connectionId, callId, targetId);
  } else if (!isAutomation(connection.provider) || !connection.secrets.outboundWebhookUrl) throw new RevenueError("Configure an outbound automation destination first.");
  const orgId = currentTenantId(); const id = stableId("call-export", orgId, connectionId, callId, isCrm(connection.provider) ? targetId! : eventKey); const now = new Date().toISOString();
  await db.insert(integrationExports).values({ id, orgId, connectionId, callId, targetId, event, createdAt: now, updatedAt: now }).onConflictDoNothing().run();
  const row = await db.select().from(integrationExports).where(and(eq(integrationExports.orgId, orgId), eq(integrationExports.id, id))).get();
  const { enqueueJob } = await import("./jobs");
  const jobId = await enqueueJob({ kind: "export-call", connectionId, callId, payload: { exportId: id }, key: `${id}:${row.attempt}` });
  await audit(actor, "integration.call-export.queued", id); return { exportId: id, jobId };
}

export async function queueIntegrationEvents(event: "call.imported" | "call.reviewed", callId: string, eventKey: string) {
  const rows = await db.select().from(integrationConnections).where(and(eq(integrationConnections.orgId, currentTenantId()), inArray(integrationConnections.status, ["connected", "syncing", "error"]))).all();
  const { meta } = await sourceCall(callId);
  for (const row of rows) {
    const config = parseJson<ConnectionConfig>(row.config, {} as ConnectionConfig);
    if (isAutomation(row.provider) && config.outboundConfigured && (event === "call.imported" ? config.outboundOnImported : config.outboundOnReviewed))
      await queueCallExport(row.id, callId, "integration-worker", undefined, event, `${event}:${eventKey}`);
    if (isCrm(row.provider) && event === "call.reviewed" && config.exportReviewed) {
      const targets = await db.select().from(crmRecords).where(and(eq(crmRecords.orgId, currentTenantId()), eq(crmRecords.connectionId, row.id), inArray(crmRecords.id, parseJson<string[]>(meta?.crmRecordIds, [])))).all();
      // Prefer the deal timeline; one note per linked record and call prevents duplicate reviews.
      const selected = targets.some((r: any) => r.kind === "deal") ? targets.filter((r: any) => r.kind === "deal") : targets;
      for (const target of selected) await queueCallExport(row.id, callId, "integration-worker", target.id, event, eventKey);
    }
  }
}

export async function executeCallExport(connection: Awaited<ReturnType<typeof getConnection>>, id: string) {
  const orgId = currentTenantId(); const scope = and(eq(integrationExports.id, id), eq(integrationExports.orgId, orgId), eq(integrationExports.connectionId, connection.id));
  const row = await db.select().from(integrationExports).where(scope).get();
  if (!row) return { skipped: "The export was deleted." };
  if (row.status === "completed") return { exportedCall: row.externalId };
  const automation = isAutomation(connection.provider);
  if (row.status !== "queued") throw new ExportDeliveryError("Delivery needs review. Check the destination before confirming a retry.", 409);
  let source: Awaited<ReturnType<typeof sourceCall>>; let target: Awaited<ReturnType<typeof linkedTarget>> | undefined;
  try {
    source = await sourceCall(row.callId);
    if (isCrm(connection.provider)) target = await linkedTarget(connection.id, row.callId, row.targetId || "");
    if (row.event === "call.reviewed" && (!source.meta?.reviewedAt || !(automation ? connection.config.outboundOnReviewed : connection.config.exportReviewed))) throw new RevenueError("Reviewed-call export was disabled or the review was removed.", 409);
    if (row.event === "call.imported" && !connection.config.outboundOnImported) throw new RevenueError("Imported-call export was disabled.", 409);
  } catch (error) {
    if (!(error instanceof RevenueError)) throw error;
    await db.update(integrationExports).set({ status: "cancelled", lastError: error.message, updatedAt: new Date().toISOString() }).where(scope).run();
    return { skipped: error.message };
  }
  if (automation && !connection.secrets.outboundWebhookUrl) throw new ExportDeliveryError("Configure the outbound destination again.");
  await getConnection(connection.id);
  const claimed = await db.update(integrationExports).set({ status: "sending", updatedAt: new Date().toISOString() }).where(and(scope, eq(integrationExports.status, "queued"))).returning().all();
  if (!claimed.length) throw new ExportDeliveryError("Another worker is sending this export.", 409);
  const { call, meta } = source; const title = meta?.title || `${call.prospectCompany || "Sales call"} · ${call.callStage}`;
  const origin = runtimeSecret("PUBLIC_APP_URL"); const callUrl = origin ? new URL(`/app/calls/${encodeURIComponent(call.id)}`, origin).toString() : null;
  const actionItems = parseJson<ActionItem[]>(meta?.actionItems, []);
  const linked = await db.select({ provider: crmRecords.provider, kind: crmRecords.kind, externalId: crmRecords.externalId, name: crmRecords.name, stage: crmRecords.stage, amount: crmRecords.amount, currency: crmRecords.currency }).from(crmRecords).where(and(eq(crmRecords.orgId, orgId), inArray(crmRecords.id, parseJson<string[]>(meta?.crmRecordIds, [])))).all();
  const summary = meta?.summary || call.evaluation?.bottomLine || "";
  const text = [`Sales Coach: ${title}`, `Rep: ${call.repName}`, `Date: ${call.createdAt}`, `Duration: ${call.durationSeconds}s`, summary,
    call.evaluation ? `Coaching: ${call.evaluation.bottomLine}\nScript score: ${call.evaluation.sandlerBreakdown.scriptAdherence.score}/10` : "",
    actionItems.length ? `Next steps:\n${actionItems.map(a => `${a.completed ? "Done" : "Open"}: ${a.description}${a.assignee ? ` (${a.assignee})` : ""}`).join("\n")}` : "", callUrl || ""].filter(Boolean).join("\n\n").slice(0, 50000);
  try {
    const externalId = automation ? await sendAutomationEvent(connection.provider, connection.secrets.outboundWebhookUrl, id, { version: 1, eventId: id, event: row.event, occurredAt: row.createdAt,
      call: { id: call.id, externalId: meta?.externalId, source: meta?.source || "upload", title, repName: call.repName, prospectName: call.prospectName, company: call.prospectCompany, stage: call.callStage, createdAt: call.createdAt, durationSeconds: call.durationSeconds, summary, actionItems, crmRecords: linked, participants: parseJson(meta?.participants, []), callUrl, reviewedAt: meta?.reviewedAt, coaching: call.evaluation ? { bottomLine: call.evaluation.bottomLine, scriptScore: call.evaluation.sandlerBreakdown.scriptAdherence.score } : null } })
      : await createCrmNote(connection.provider, connection.secrets.token, target!, { title, text, createdAt: call.createdAt, callUrl });
    await db.update(integrationExports).set({ status: "completed", externalId, lastError: null, updatedAt: new Date().toISOString() }).where(and(scope, eq(integrationExports.status, "sending"))).run();
    return { exportedCall: externalId };
  } catch (error) {
    if ((error instanceof ProviderError && error.providerStatus === 429) || (automation && !(error instanceof ProviderError && [400, 401, 403, 404, 422].includes(error.providerStatus)))) {
      await db.update(integrationExports).set({ status: "queued", updatedAt: new Date().toISOString() }).where(and(scope, eq(integrationExports.status, "sending"))).run(); throw error;
    }
    const definite = error instanceof ProviderError && [400, 401, 403, 404, 422].includes(error.providerStatus);
    const message = definite ? "Export was rejected. Check write permissions and destination setup." : "Delivery outcome is uncertain. Check the destination before confirming a retry.";
    await db.update(integrationExports).set({ status: definite ? "failed" : "uncertain", lastError: message, updatedAt: new Date().toISOString() }).where(and(scope, eq(integrationExports.status, "sending"))).run();
    throw new ExportDeliveryError(message, 409);
  }
}

export async function listCallExports(connectionId: string) {
  await ensureRevenueSchema(); await getConnection(connectionId);
  const orgId = currentTenantId();
  const rows = await db.select().from(integrationExports).where(and(eq(integrationExports.orgId, orgId), eq(integrationExports.connectionId, connectionId))).orderBy(desc(integrationExports.createdAt)).limit(100).all();
  const jobIds = rows.map((row: any) => stableId("job", orgId, "export-call", `${row.id}:${row.attempt}`));
  const jobs = jobIds.length ? await db.select().from(processingJobs).where(and(eq(processingJobs.orgId, orgId), inArray(processingJobs.id, jobIds))).all() : [];
  return rows.map((row: any) => {
    const job = jobs.find((job: any) => job.id === stableId("job", orgId, "export-call", `${row.id}:${row.attempt}`));
    return { ...row, lastError: row.lastError || job?.lastError, canRetry: job?.status === "failed" && ["failed", "uncertain", "sending", "queued"].includes(row.status) };
  });
}
export async function retryCallExport(connectionId: string, id: string, confirmedMissing: boolean, actor: string) {
  await getConnection(connectionId); if (!confirmedMissing) throw new RevenueError("Check the destination and confirm that this export was not received before retrying.");
  const orgId = currentTenantId(); const scope = and(eq(integrationExports.id, id), eq(integrationExports.orgId, orgId), eq(integrationExports.connectionId, connectionId));
  const row = await db.select().from(integrationExports).where(scope).get(); if (!row) throw new RevenueError("Export not found.", 404);
  const jobId = stableId("job", orgId, "export-call", `${id}:${row.attempt}`);
  const job = await db.select().from(processingJobs).where(and(eq(processingJobs.id, jobId), eq(processingJobs.orgId, orgId))).get();
  if (job?.status !== "failed" || !["failed", "uncertain", "sending", "queued"].includes(row.status)) throw new RevenueError("Wait for the current delivery to finish before retrying.", 409);
  const updated = await db.update(integrationExports).set({ status: "queued", attempt: row.attempt + 1, lastError: null, updatedAt: new Date().toISOString() }).where(and(scope, eq(integrationExports.attempt, row.attempt), eq(integrationExports.status, row.status))).returning().all();
  if (!updated.length) throw new RevenueError("This export was already retried.", 409);
  await audit(actor, "integration.call-export.retry-confirmed", id);
  const { enqueueJob } = await import("./jobs");
  return { jobId: await enqueueJob({ kind: "export-call", connectionId, callId: row.callId, payload: { exportId: id }, key: `${id}:${row.attempt + 1}` }) };
}

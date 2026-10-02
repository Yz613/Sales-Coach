import { and, desc, eq, inArray } from "drizzle-orm";
import { db, ensureRevenueSchema } from "../db";
import { externalTasks, taskExports, calls, callMetadata, processingJobs } from "../db/schema";
import { currentTenantId } from "../tenant";
import { getCallById } from "../db/service";
import { getConnection, audit } from "./connections";
import { isTaskTool } from "../integrations/catalog";
import { createProviderTask } from "../integrations/tasks";
import { ProviderError } from "../integrations/http";
import { stableId, RevenueError, textInput } from "./security";
import { runtimeSecret } from "./runtime";
import { parseJson, type ActionItem, type ExternalTask, type TaskProvider } from "./types";

export async function storeExternalTask(connection: { id: string; provider: string }, task: ExternalTask, callId?: string) {
  const values = { ...task, id: stableId("task", currentTenantId(), connection.id, task.externalId), orgId: currentTenantId(), connectionId: connection.id,
    provider: connection.provider, ...(callId ? { callId } : {}), syncedAt: new Date().toISOString() };
  await db.insert(externalTasks).values(values).onConflictDoUpdate({ target: externalTasks.id, set: values }).run();
}
export async function taskWorkspace(connectionId: string) {
  await ensureRevenueSchema(); const orgId = currentTenantId();
  const [tasks, exports, conversations] = await Promise.all([
    db.select().from(externalTasks).where(and(eq(externalTasks.orgId, orgId), eq(externalTasks.connectionId, connectionId))).orderBy(desc(externalTasks.syncedAt)).limit(100).all(),
    db.select().from(taskExports).where(and(eq(taskExports.orgId, orgId), eq(taskExports.connectionId, connectionId))).orderBy(desc(taskExports.createdAt)).limit(100).all(),
    db.select({ callId: calls.id, title: callMetadata.title, actionItems: callMetadata.actionItems }).from(calls).innerJoin(callMetadata, eq(calls.id, callMetadata.callId))
      .where(and(eq(calls.orgId, orgId), eq(callMetadata.orgId, orgId))).orderBy(desc(calls.createdAt)).limit(100).all(),
  ]);
  return { tasks, exports, actionItems: conversations.flatMap((call: any) => parseJson<ActionItem[]>(call.actionItems, []).filter(item => !item.completed).map(item => ({ ...item, callId: call.callId, callTitle: call.title }))) };
}
async function sourceAction(callId: string, actionId: string) {
  const call = await getCallById(callId); if (!call) throw new RevenueError("Call not found.", 404);
  const meta = await db.select().from(callMetadata).where(and(eq(callMetadata.orgId, currentTenantId()), eq(callMetadata.callId, callId))).get();
  const item = parseJson<ActionItem[]>(meta?.actionItems, []).find(item => item.id === actionId);
  if (!item || item.completed) throw new RevenueError("Choose an open coaching action item.", 409);
  return { item, callTitle: meta?.title || "Sales call" };
}
export async function queueTaskExport(connectionId: string, callId: string, actionId: string, actor: string) {
  const connection = await getConnection(connectionId); if (!isTaskTool(connection.provider)) throw new RevenueError("Choose a task integration.");
  const { item } = await sourceAction(callId, actionId); const orgId = currentTenantId(); const id = stableId("task-export", orgId, connectionId, callId, actionId); const now = new Date().toISOString();
  await db.insert(taskExports).values({ id, orgId, connectionId, callId, actionId, title: textInput(item.description, "Action item", 2000), createdAt: now, updatedAt: now }).onConflictDoNothing().run();
  const saved = await db.select().from(taskExports).where(and(eq(taskExports.id, id), eq(taskExports.orgId, orgId))).get();
  const { enqueueJob } = await import("./jobs");
  const jobId = await enqueueJob({ kind: "export-task", connectionId, callId, payload: { exportId: id }, key: `${id}:${saved.attempt}` });
  await audit(actor, "integration.task.queued", id); return { exportId: id, jobId };
}
export class TaskDeliveryError extends RevenueError { readonly nonRetryable = true; }
export async function executeTaskExport(connection: Awaited<ReturnType<typeof getConnection>>, id: string) {
  const orgId = currentTenantId(); const scoped = and(eq(taskExports.id, id), eq(taskExports.orgId, orgId), eq(taskExports.connectionId, connection.id));
  const row = await db.select().from(taskExports).where(scoped).get();
  if (!row || !isTaskTool(connection.provider)) throw new TaskDeliveryError("Task export not found.", 404);
  if (row.status === "completed") return { exported: row.externalId, sourceUrl: row.sourceUrl };
  if (row.status !== "queued") throw new TaskDeliveryError("Task delivery needs review. Check the destination before confirming a retry.", 409);
  let source: Awaited<ReturnType<typeof sourceAction>>;
  try { source = await sourceAction(row.callId, row.actionId); }
  catch (error) {
    if (!(error instanceof RevenueError)) throw error;
    await db.update(taskExports).set({ status: "cancelled", lastError: error.message, updatedAt: new Date().toISOString() }).where(scoped).run();
    return { skipped: "The source action was completed or deleted before delivery." };
  }
  const { item, callTitle } = source;
  await getConnection(connection.id);
  const claimed = await db.update(taskExports).set({ status: "sending", updatedAt: new Date().toISOString() }).where(and(scoped, eq(taskExports.status, "queued"))).returning().all();
  if (!claimed.length) throw new TaskDeliveryError("Another worker is sending this task. Check its delivery status.", 409);
  const origin = runtimeSecret("PUBLIC_APP_URL"); const callUrl = origin ? new URL(`/app/calls/${encodeURIComponent(row.callId)}`, origin).toString() : "";
  try {
    const task = await createProviderTask(connection.provider as TaskProvider, connection.secrets, connection.config, item.description.slice(0, 200), `${item.description}\n\nCoaching follow-up: ${callTitle}${callUrl ? `\n${callUrl}` : ""}`);
    await getConnection(connection.id); await storeExternalTask(connection, task, row.callId);
    await db.update(taskExports).set({ status: "completed", externalId: task.externalId, sourceUrl: task.sourceUrl, lastError: null, updatedAt: new Date().toISOString() }).where(scoped).run();
    return { exported: task.externalId, sourceUrl: task.sourceUrl };
  } catch (error) {
    if (error instanceof ProviderError && error.providerStatus === 429) { await db.update(taskExports).set({ status: "queued" }).where(scoped).run(); throw error; }
    const definite = error instanceof ProviderError && [400, 401, 403, 404, 422].includes(error.providerStatus);
    const message = definite ? `${connection.provider}: task creation was rejected. Check write permissions and destination configuration.` : "Task delivery outcome is uncertain. Check the destination for this action before confirming a retry.";
    await db.update(taskExports).set({ status: definite ? "failed" : "uncertain", lastError: message, updatedAt: new Date().toISOString() }).where(scoped).run();
    throw new TaskDeliveryError(message, 409);
  }
}
export async function retryTaskExport(connectionId: string, id: string, confirmedMissing: boolean, actor: string) {
  await getConnection(connectionId); if (!confirmedMissing) throw new RevenueError("Check the destination and confirm that no task was created before retrying.");
  const orgId = currentTenantId(); const scoped = and(eq(taskExports.id, id), eq(taskExports.orgId, orgId), eq(taskExports.connectionId, connectionId));
  const row = await db.select().from(taskExports).where(scoped).get(); if (!row) throw new RevenueError("Task export not found.", 404);
  const jobId = stableId("job", orgId, "export-task", `${id}:${row.attempt}`);
  const job = await db.select().from(processingJobs).where(and(eq(processingJobs.id, jobId), eq(processingJobs.orgId, orgId))).get();
  if (job?.status !== "failed" || !["failed", "uncertain", "sending"].includes(row.status)) throw new RevenueError("Wait for the current task delivery to finish before retrying.", 409);
  const updated = await db.update(taskExports).set({ status: "queued", attempt: row.attempt + 1, lastError: null, updatedAt: new Date().toISOString() }).where(and(scoped, eq(taskExports.attempt, row.attempt), inArray(taskExports.status, ["failed", "uncertain", "sending"]))).returning().all();
  if (!updated.length) throw new RevenueError("This task was already retried.", 409);
  await audit(actor, "integration.task.retry-confirmed", id);
  const { enqueueJob } = await import("./jobs");
  return { jobId: await enqueueJob({ kind: "export-task", connectionId, callId: row.callId, payload: { exportId: id }, key: `${id}:${row.attempt + 1}` }) };
}

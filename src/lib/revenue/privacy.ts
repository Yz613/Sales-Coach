import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { db, ensureRevenueSchema } from "../db";
import { calls, callMetadata, conversationClips, conversationComments, scoreOverrides, evaluations, processingJobs, repSnapshots, deletedImports, auditEvents, taskExports, externalTasks, integrationExports, callProviderInsights } from "../db/schema";
import { currentTenantId, runWithTenant } from "../tenant";
import { getSetting, setSetting, getCoachLessons, deleteCoachLesson } from "../db/service";
import { deleteCallAudio } from "../callAudioStore";
import { audit } from "./connections";
import { RevenueError } from "./security";
import type { Call } from "../../types";
import { conversationDetail } from "./conversations";
import type { Segment } from "./types";

export async function deleteConversation(id: string, actor: string) {
  const orgId = currentTenantId();
  const row = await db.select().from(calls).where(and(eq(calls.orgId, orgId), eq(calls.id, id))).get();
  if (!row) throw new RevenueError("Call not found.", 404);
  // The tombstone prevents a later Fathom sync or retried delivery from restoring deleted data.
  await db.insert(deletedImports).values({ id, orgId, deletedAt: new Date().toISOString() }).onConflictDoNothing().run();
  await db.update(processingJobs).set({ status: "cancelled", payload: "{}", result: null, leaseToken: null, leaseUntil: null }).where(and(eq(processingJobs.orgId, orgId), eq(processingJobs.callId, id))).run();
  // Storage deletion happens first: a storage outage leaves a retryable call instead of orphaned media.
  if (row.audioUrl) await deleteCallAudio(id);
  for (const table of [conversationClips, conversationComments, scoreOverrides, callMetadata, evaluations, callProviderInsights, integrationExports]) await db.delete(table).where(and(eq(table.orgId, orgId), eq(table.callId, id))).run();
  await db.delete(taskExports).where(and(eq(taskExports.orgId, orgId), eq(taskExports.callId, id))).run();
  await db.update(externalTasks).set({ callId: null }).where(and(eq(externalTasks.orgId, orgId), eq(externalTasks.callId, id))).run();
  for (const lesson of await getCoachLessons()) if (lesson.sourceCallId === id) await deleteCoachLesson(lesson.id);
  await db.delete(repSnapshots).where(and(eq(repSnapshots.orgId, orgId), eq(repSnapshots.repId, row.repId))).run();
  await db.delete(calls).where(and(eq(calls.orgId, orgId), eq(calls.id, id))).run();
  await audit(actor, "conversation.deleted", id);
}

export async function privacySettings() {
  return { retentionDays: Number(await getSetting("conversation_retention_days")) || 0,
    audit: await db.select().from(auditEvents).where(eq(auditEvents.orgId, currentTenantId())).orderBy(desc(auditEvents.createdAt)).limit(100).all() };
}
export async function setRetention(days: unknown, actor: string) {
  const n = Number(days); if (!Number.isInteger(n) || n < 0 || n > 3650) throw new RevenueError("Retention must be 0–3650 days; 0 keeps calls indefinitely.");
  await setSetting("conversation_retention_days", String(n)); await audit(actor, "retention.updated", String(n));
}
export async function purgeExpiredConversations() {
  await ensureRevenueSchema();
  const orgId = currentTenantId(); const days = Number(await getSetting("conversation_retention_days")) || 0;
  if (!days) return { deleted: 0 };
  const expired = await db.select({ id: calls.id }).from(calls).where(and(eq(calls.orgId, orgId), lt(calls.createdAt, new Date(Date.now() - days * 86400000).toISOString()))).limit(50).all();
  for (const row of expired) await deleteConversation(row.id, "retention-worker");
  return { deleted: expired.length };
}
export async function scheduledRetention() {
  const orgs = await db.selectDistinct({ orgId: calls.orgId }).from(calls).all();
  for (const row of orgs) await runWithTenant(row.orgId, purgeExpiredConversations);
}

export async function exportConversation(call: Call, format: string) {
  if (!["json", "vtt", "srt"].includes(format)) throw new RevenueError("Choose JSON, VTT or SRT export.");
  const detail = await conversationDetail(call);
  if (format === "json") return { content: JSON.stringify({ version: 1, call, conversation: detail }, null, 2), mime: "application/json", extension: "json" };
  const stamp = (s: number) => new Date(Math.max(0, s) * 1000).toISOString().slice(11, 23);
  const vtt = format !== "srt";
  const content = (vtt ? "WEBVTT\n\n" : "") + detail.segments.map((s: Segment, i: number) => `${i + 1}\n${stamp(s.start).replace(".", vtt ? "." : ",")} --> ${stamp(Math.max(s.start + .1, s.end || s.start + 5)).replace(".", vtt ? "." : ",")}\n${s.speaker}: ${s.text}\n`).join("\n");
  return { content, mime: vtt ? "text/vtt" : "text/plain", extension: vtt ? "vtt" : "srt" };
}

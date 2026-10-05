import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { calls, callMetadata, crmRecords, deletedImports, callProviderInsights } from "../db/schema";
import { getOrCreateRep } from "../db/service";
import { currentTenantId } from "../tenant";
import { stableId } from "./security";
import { classifyCoreOutcomeFromTranscript } from "../coreOutcome";
import { crmLinkIds } from "./matching";
import { parseJson, type ActionItem, type ImportedMeeting } from "./types";

export function importedCallId(orgId: string, connectionId: string, externalId: string): string {
  return `import_${stableId(orgId, connectionId, externalId)}`;
}

export async function importMeeting(connection: { id: string; provider?: string; config: { defaultStage: string } }, meeting: ImportedMeeting) {
  const orgId = currentTenantId(); const callId = importedCallId(orgId, connection.id, meeting.externalId);
  const deleted = await db.select().from(deletedImports).where(and(eq(deletedImports.id, callId), eq(deletedImports.orgId, orgId))).get();
  if (deleted) return { callId, inserted: false, deleted: true };
  const repId = await getOrCreateRep(undefined, meeting.repName, "Sales Rep", meeting.repEmail);
  const inserted = await db.insert(calls).values({ id: callId, orgId, repId, prospectCompany: meeting.prospectCompany, prospectName: meeting.prospectName,
    callStage: connection.config.defaultStage, coreOutcome: classifyCoreOutcomeFromTranscript(meeting.transcriptText), durationSeconds: meeting.durationSeconds, transcriptText: meeting.transcriptText,
    status: "completed", createdAt: meeting.createdAt }).onConflictDoNothing().returning({ id: calls.id }).all();
  const records = await db.select({ id: crmRecords.id, provider: crmRecords.provider, externalId: crmRecords.externalId, kind: crmRecords.kind, email: crmRecords.email, properties: crmRecords.properties, associations: crmRecords.associations }).from(crmRecords).where(eq(crmRecords.orgId, orgId)).all();
  // Later summary-ready events enrich existing calls while keeping reviews and completed action items.
  const previous = await db.select().from(callMetadata).where(and(eq(callMetadata.callId, callId), eq(callMetadata.orgId, orgId))).get();
  const emails = meeting.participants.filter(person => person.external && person.email).map(person => person.email!.toLowerCase());
  const crmIds = crmLinkIds(records, meeting.crmMatches, emails, parseJson<string[]>(previous?.crmRecordIds, []));
  const previousActions = parseJson<ActionItem[]>(previous?.actionItems, []);
  const actionItems = meeting.actionItems.map(item => ({ ...item, completed: previousActions.find(old => old.id === item.id)?.completed ?? item.completed }));
  const metadata = { title: meeting.title, source: connection.provider || "fathom", externalId: meeting.externalId, connectionId: connection.id,
    recordingPageUrl: meeting.recordingPageUrl, participants: JSON.stringify(meeting.participants), summary: meeting.summary,
    actionItems: JSON.stringify(actionItems.length ? actionItems : previousActions), segments: JSON.stringify(meeting.segments), crmRecordIds: JSON.stringify([...new Set([...parseJson<string[]>(previous?.crmRecordIds, []), ...crmIds])]), crmMatches: JSON.stringify(meeting.crmMatches) };
  if (!metadata.summary && previous?.summary) metadata.summary = previous.summary;
  await db.insert(callMetadata).values({ callId, orgId, ...metadata, createdAt: meeting.createdAt })
    .onConflictDoUpdate({ target: callMetadata.callId, set: metadata }).run();
  if (meeting.providerInsights) await db.insert(callProviderInsights).values({ callId, orgId, data: JSON.stringify(meeting.providerInsights) })
    .onConflictDoUpdate({ target: callProviderInsights.callId, set: { data: JSON.stringify(meeting.providerInsights) } }).run();
  if (inserted.length) {
    const { queueIntegrationEvents } = await import("./exports");
    await queueIntegrationEvents("call.imported", callId, callId);
  }
  const { autoApplyScorecardsForCall } = await import("../scorecards");
  await autoApplyScorecardsForCall(callId);
  if (meeting.transcriptText.trim()) {
    const { enqueueAlertScan } = await import("./alerts");
    await enqueueAlertScan(callId, { mode: "concepts", key: `content:${callId}:${stableId(meeting.transcriptText).slice(0, 12)}` });
  }
  return { callId, inserted: inserted.length > 0, deleted: false };
}

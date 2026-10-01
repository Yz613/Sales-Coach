import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { calls, callMetadata, crmRecords, deletedImports } from "../db/schema";
import { getOrCreateRep } from "../db/service";
import { currentTenantId } from "../tenant";
import { stableId } from "./security";
import { classifyCoreOutcomeFromTranscript } from "../coreOutcome";
import type { ImportedMeeting } from "./types";

export function importedCallId(orgId: string, connectionId: string, externalId: string): string {
  return `import_${stableId(orgId, connectionId, externalId)}`;
}

export async function importMeeting(connection: { id: string; config: { defaultStage: string } }, meeting: ImportedMeeting) {
  const orgId = currentTenantId(); const callId = importedCallId(orgId, connection.id, meeting.externalId);
  const deleted = await db.select().from(deletedImports).where(and(eq(deletedImports.id, callId), eq(deletedImports.orgId, orgId))).get();
  if (deleted) return { callId, inserted: false, deleted: true };
  const repId = await getOrCreateRep(undefined, meeting.repName, "Sales Rep", meeting.repEmail);
  const inserted = await db.insert(calls).values({ id: callId, orgId, repId, prospectCompany: meeting.prospectCompany, prospectName: meeting.prospectName,
    callStage: connection.config.defaultStage, coreOutcome: classifyCoreOutcomeFromTranscript(meeting.transcriptText), durationSeconds: meeting.durationSeconds, transcriptText: meeting.transcriptText,
    status: "completed", createdAt: meeting.createdAt }).onConflictDoNothing().returning({ id: calls.id }).all();
  const records = await db.select({ id: crmRecords.id, externalId: crmRecords.externalId, kind: crmRecords.kind, email: crmRecords.email }).from(crmRecords).where(eq(crmRecords.orgId, orgId)).all();
  const crmIds = records.filter((record: any) => meeting.crmMatches.some((match) => record.kind === match.kind && ((match.externalId && record.externalId === match.externalId) || (match.email && record.email?.toLowerCase() === match.email.toLowerCase())))).map((record: any) => record.id);
  // Retried deliveries can repair a partially completed import without replacing manager feedback.
  await db.insert(callMetadata).values({ callId, orgId, title: meeting.title, source: "fathom", externalId: meeting.externalId, connectionId: connection.id,
    recordingPageUrl: meeting.recordingPageUrl, participants: JSON.stringify(meeting.participants), summary: meeting.summary,
    actionItems: JSON.stringify(meeting.actionItems), segments: JSON.stringify(meeting.segments), crmRecordIds: JSON.stringify(crmIds), crmMatches: JSON.stringify(meeting.crmMatches), createdAt: meeting.createdAt })
    .onConflictDoNothing().run();
  return { callId, inserted: inserted.length > 0, deleted: false };
}

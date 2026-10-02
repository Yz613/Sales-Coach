import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { db, ensureRevenueSchema } from "../db";
import { calls, callMetadata, scheduledMeetings, crmRecords } from "../db/schema";
import { currentTenantId } from "../tenant";
import { stableId } from "./security";
import { parseJson, type Participant, type ScheduledMeeting } from "./types";

export async function storeScheduledMeeting(connection: { id: string; provider: string }, meeting: ScheduledMeeting, preserveInvitees = false) {
  const orgId = currentTenantId(); const values = { ...meeting, id: stableId("meeting", orgId, connection.id, meeting.externalId), orgId, connectionId: connection.id, provider: connection.provider,
    participants: JSON.stringify(meeting.participants), syncedAt: new Date().toISOString() };
  if (preserveInvitees) {
    const old = await db.select({ participants: scheduledMeetings.participants }).from(scheduledMeetings).where(and(eq(scheduledMeetings.id, values.id), eq(scheduledMeetings.orgId, orgId))).get();
    if (old) values.participants = JSON.stringify([...meeting.participants, ...parseJson<Participant[]>(old.participants, []).filter(p => p.external)]);
  }
  await db.insert(scheduledMeetings).values(values).onConflictDoUpdate({ target: scheduledMeetings.id, set: values }).run();
}
export function meetingMatchesCall(meeting: { startAt: string; status: string; participants: Participant[] }, call: { createdAt: string; participants: Participant[] }) {
  if (meeting.status !== "scheduled" || Math.abs(Date.parse(meeting.startAt) - Date.parse(call.createdAt)) > 2 * 3600000) return false;
  const external = call.participants.filter(p => p.external && p.email).map(p => p.email!.toLowerCase());
  return meeting.participants.some(p => p.external && p.email && external.includes(p.email.toLowerCase()));
}
export async function meetingContextForCall(call: { createdAt: string }, participants: Participant[]) {
  const rows = await db.select().from(scheduledMeetings).where(and(eq(scheduledMeetings.orgId, currentTenantId()),
    gte(scheduledMeetings.startAt, new Date(Date.parse(call.createdAt) - 7200000).toISOString()), lte(scheduledMeetings.startAt, new Date(Date.parse(call.createdAt) + 7200000).toISOString()))).all();
  return rows.map((row: any) => ({ ...row, participants: parseJson<Participant[]>(row.participants, []) })).filter((row: any) => meetingMatchesCall(row, { ...call, participants }));
}
export async function listScheduledMeetings(connectionId?: string, past = false) {
  await ensureRevenueSchema(); const orgId = currentTenantId(); const now = new Date().toISOString();
  const rows = await db.select().from(scheduledMeetings).where(and(eq(scheduledMeetings.orgId, orgId), connectionId ? eq(scheduledMeetings.connectionId, connectionId) : undefined,
    past ? lte(scheduledMeetings.startAt, now) : gte(scheduledMeetings.startAt, now))).orderBy(past ? desc(scheduledMeetings.startAt) : asc(scheduledMeetings.startAt)).limit(100).all();
  if (!rows.length) return [];
  const [contacts, conversations] = await Promise.all([
    db.select({ id: crmRecords.id, name: crmRecords.name, email: crmRecords.email }).from(crmRecords).where(and(eq(crmRecords.orgId, orgId), eq(crmRecords.kind, "contact"))).all(),
    db.select({ id: calls.id, createdAt: calls.createdAt, participants: callMetadata.participants }).from(calls).innerJoin(callMetadata, eq(calls.id, callMetadata.callId))
      .where(and(eq(calls.orgId, orgId), eq(callMetadata.orgId, orgId), gte(calls.createdAt, new Date(Date.parse(rows.at(past ? -1 : 0).startAt) - 7200000).toISOString()),
        lte(calls.createdAt, new Date(Date.parse(rows.at(past ? 0 : -1).startAt) + 7200000).toISOString()))).all(),
  ]);
  return rows.map((row: any) => {
    const meeting = { ...row, participants: parseJson<Participant[]>(row.participants, []) };
    const emails = meeting.participants.filter((p: Participant) => p.external && p.email).map((p: Participant) => p.email!.toLowerCase());
    return { ...meeting, contacts: contacts.filter((c: any) => c.email && emails.includes(c.email.toLowerCase())),
      linkedCalls: conversations.filter((call: any) => meetingMatchesCall(meeting, { ...call, participants: parseJson<Participant[]>(call.participants, []) })).map((call: any) => call.id) };
  });
}

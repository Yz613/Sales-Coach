import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { callMetadata, calls, crmRecords } from "../db/schema";
import { currentTenantId } from "../tenant";
import { parseJson, type ActionItem, type ImportedMeeting, type Participant } from "./types";

export async function crmOverview() {
  const orgId = currentTenantId();
  const records = await db.select().from(crmRecords).where(eq(crmRecords.orgId, orgId)).orderBy(desc(crmRecords.syncedAt)).all();
  const conversations = await db.select({ id: calls.id, repId: calls.repId, company: calls.prospectCompany, stage: calls.callStage, createdAt: calls.createdAt, title: callMetadata.title, ids: callMetadata.crmRecordIds, actions: callMetadata.actionItems }).from(calls).innerJoin(callMetadata, eq(calls.id, callMetadata.callId)).where(and(eq(calls.orgId, orgId), eq(callMetadata.orgId, orgId))).orderBy(desc(calls.createdAt)).all();
  const deals = records.filter((r: any) => r.kind === "deal").map((deal: any) => {
    const ids = new Set([deal.id, ...parseJson<string[]>(deal.associations, [])]);
    const linkedCalls = conversations.filter((c: any) => parseJson<string[]>(c.ids, []).some(id => ids.has(id))).map((c: any) => ({ id: c.id, title: c.title, createdAt: c.createdAt, stage: c.stage }));
    const linkedRaw = conversations.filter((c: any) => linkedCalls.some((l: any) => l.id === c.id));
    const openActions = linkedRaw.reduce((sum: number, c: any) => sum + parseJson<ActionItem[]>(c.actions, []).filter(a => !a.completed).length, 0);
    const risks: string[] = [];
    if (!deal.closed) {
      if (!linkedCalls.length) risks.push("No linked conversations");
      else if (Date.now() - Date.parse(linkedCalls[0].createdAt) > 14 * 86400000) risks.push("No conversation in 14 days");
      if (deal.closeDate && Date.parse(deal.closeDate) < Date.now()) risks.push("Close date has passed");
      if (linkedCalls.length && !openActions) risks.push("No open action items");
    }
    const associated = records.filter((r: any) => ids.has(r.id) && r.id !== deal.id).map((r: any) => ({ id: r.id, name: r.name, kind: r.kind, email: r.email }));
    const { properties, associations, ...safe } = deal;
    return { ...safe, won: parseJson<Record<string, string>>(properties, {}).hs_is_closed_won === "true", linkedCalls, associated, openActions, risks };
  });
  const totals: Record<string, number> = {};
  for (const d of deals) if (!d.closed && d.amount && Number.isFinite(Number(d.amount))) { const currency = d.currency || "Unspecified currency"; totals[currency] = (totals[currency] || 0) + Number(d.amount); }
  return { deals, totals, companies: records.filter((r: any) => r.kind === "company").length, contacts: records.filter((r: any) => r.kind === "contact").length };
}

/** Repair matching when the CRM is connected after meeting imports; preserve manual deal links. */
export async function relinkConversations() {
  const orgId = currentTenantId();
  const records = await db.select().from(crmRecords).where(eq(crmRecords.orgId, orgId)).all();
  const metadata = await db.select().from(callMetadata).where(eq(callMetadata.orgId, orgId)).all();
  for (const meta of metadata) {
    const matches = parseJson<ImportedMeeting["crmMatches"]>(meta.crmMatches, []);
    const externalEmails = parseJson<Participant[]>(meta.participants, []).filter(p => p.external && p.email).map(p => p.email!.toLowerCase());
    const found = records.filter((r: any) => matches.some(m => r.kind === m.kind && ((m.externalId && m.externalId === r.externalId) || (m.email && m.email.toLowerCase() === r.email?.toLowerCase()))) || (r.kind === "contact" && r.email && externalEmails.includes(r.email.toLowerCase())));
    const ids = [...new Set([...parseJson<string[]>(meta.crmRecordIds, []), ...found.map((r: any) => r.id)])];
    if (JSON.stringify(ids) !== meta.crmRecordIds) await db.update(callMetadata).set({ crmRecordIds: JSON.stringify(ids) }).where(and(eq(callMetadata.orgId, orgId), eq(callMetadata.callId, meta.callId))).run();
  }
}

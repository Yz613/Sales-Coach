import { and, desc, eq, inArray } from "drizzle-orm";
import { createHash } from "node:crypto";
import { db } from "../db";
import { callMetadata, calls, crmRecords, dealReviews } from "../db/schema";
import { currentTenantId } from "../tenant";
import { parseJson, type ActionItem, type ImportedMeeting, type Participant, type Segment } from "./types";
import { matchesCrmRecord } from "./matching";
import { amountValue, dealCurrency, storedReview, type DealSummary, type EvidenceRef } from "./forecast-model";

export async function crmOverview() {
  const orgId = currentTenantId();
  const records = await db.select().from(crmRecords).where(eq(crmRecords.orgId, orgId)).orderBy(desc(crmRecords.syncedAt)).all();
  const reviews: any[] = await db.select().from(dealReviews).where(eq(dealReviews.orgId, orgId)).all();
  const reviewsByDeal = new Map(reviews.map(r => [r.dealId, r]));
  const evidenceCallIds = [...new Set(reviews.flatMap(r => Object.values(parseJson<Record<string, { evidence?: EvidenceRef }>>(r.playbook, {})).map(item => item?.evidence?.callId).filter((id): id is string => !!id)))];
  // Read only transcripts referenced by saved evidence, rather than every transcript in the workspace.
  const evidenceRows: any[] = [];
  for (let offset = 0; offset < evidenceCallIds.length; offset += 90) evidenceRows.push(...await db.select({ callId: callMetadata.callId, segments: callMetadata.segments }).from(callMetadata).where(and(eq(callMetadata.orgId, orgId), inArray(callMetadata.callId, evidenceCallIds.slice(offset, offset + 90)))).all());
  const evidenceSegments = new Map(evidenceRows.map(row => [row.callId, parseJson<Segment[]>(row.segments, [])]));
  const conversations = await db.select({ id: calls.id, repId: calls.repId, company: calls.prospectCompany, stage: calls.callStage, createdAt: calls.createdAt, title: callMetadata.title, ids: callMetadata.crmRecordIds, actions: callMetadata.actionItems }).from(calls).innerJoin(callMetadata, eq(calls.id, callMetadata.callId)).where(and(eq(calls.orgId, orgId), eq(callMetadata.orgId, orgId))).orderBy(desc(calls.createdAt)).all();
  const deals: DealSummary[] = records.filter((r: any) => r.kind === "deal").map((deal: any) => {
    const ids = new Set([deal.id, ...parseJson<string[]>(deal.associations, [])]);
    const linkedRaw = conversations.filter((c: any) => parseJson<string[]>(c.ids, []).some(id => ids.has(id)));
    const linkedCalls = linkedRaw.map((c: any) => ({ id: c.id, title: c.title, createdAt: c.createdAt, stage: c.stage }));
    const openActions = linkedRaw.reduce((sum: number, c: any) => sum + parseJson<ActionItem[]>(c.actions, []).filter(a => !a.completed).length, 0);
    const risks: string[] = [];
    if (!deal.closed) {
      if (!linkedCalls.length) risks.push("No linked conversations");
      else if (Date.now() - Date.parse(linkedCalls[0].createdAt) > 14 * 86400000) risks.push("No conversation in 14 days");
      if (deal.closeDate && deal.closeDate.slice(0, 10) < new Date().toISOString().slice(0, 10)) risks.push("Close date has passed");
      if (linkedCalls.length && !openActions) risks.push("No open action items");
    }
    const associated = records.filter((r: any) => ids.has(r.id) && r.id !== deal.id).map((r: any) => ({ id: r.id, name: r.name, kind: r.kind, email: r.email }));
    const { properties, associations, ...safe } = deal;
    const review = storedReview(reviewsByDeal.get(deal.id), e => {
      if (!linkedCalls.some((c: any) => c.id === e.callId)) return null;
      const segment = evidenceSegments.get(e.callId)?.find(s => s.start === e.start && createHash("sha256").update(s.text).digest("hex") === e.quoteHash);
      return segment ? { callId: e.callId, start: e.start, quote: segment.text } : null;
    });
    if (!deal.closed && review.nextStepDate && review.nextStepDate < new Date().toISOString().slice(0, 10)) risks.push("Review next step is overdue");
    if (!deal.closed && review.category === "commit" && !review.nextStep.trim()) risks.push("Commit has no review next step");
    return { ...safe, review, won: parseJson<Record<string, string>>(properties, {}).hs_is_closed_won === "true", linkedCalls, associated, openActions, risks };
  });
  const totals: Record<string, number> = {};
  for (const d of deals) { const amount = amountValue(d.amount); if (!d.closed && amount !== null) { const currency = dealCurrency(d); totals[currency] = (totals[currency] || 0) + amount; } }
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
    const found = records.filter((r: any) => matches.some(m => matchesCrmRecord(r, m)) || (r.kind === "contact" && r.email && externalEmails.includes(r.email.toLowerCase())));
    const ids = [...new Set([...parseJson<string[]>(meta.crmRecordIds, []), ...found.map((r: any) => r.id)])];
    if (JSON.stringify(ids) !== meta.crmRecordIds) await db.update(callMetadata).set({ crmRecordIds: JSON.stringify(ids) }).where(and(eq(callMetadata.orgId, orgId), eq(callMetadata.callId, meta.callId))).run();
  }
}

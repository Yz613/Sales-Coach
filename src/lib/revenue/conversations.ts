import { and, asc, desc, eq, inArray, isNull, isNotNull, gte, lte, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db, ensureRevenueSchema } from "../db";
import { calls, reps, callMetadata, conversationComments, conversationClips, conversationTrackers, scoreOverrides, savedSearches, crmRecords, callProviderInsights, evaluations } from "../db/schema";
import { currentTenantId } from "../tenant";
import { listRepIdentities } from "../db/service";
import { isOwnRep } from "../call-access";
import { toCallViewer } from "../viewer-calls";
import { parseLeadingTimestamp, parseTranscript } from "../transcript";
import { parseExtendedReview } from "../ai/review";
import type { AuthUser } from "../auth";
import type { Call } from "../../types";
import { RevenueError, stableId, textInput } from "./security";
import { audit } from "./connections";
import { parseJson, type ActionItem, type Segment, type ConversationFilters, type Participant } from "./types";
import { meetingContextForCall } from "./meetings";
import { queueSlackAlerts } from "../integrations/slack";

const scoped = (table: { orgId: any }) => eq(table.orgId, currentTenantId());
export const actorId = (auth: AuthUser) => auth.userId || "local-admin";
export const actorName = (auth: AuthUser) => auth.name || auth.email || "Local admin";

export function readFilters(params: URLSearchParams): ConversationFilters {
  const result: ConversationFilters = { page: Math.max(1, Math.min(10000, Number(params.get("page")) || 1)) };
  for (const key of ["q", "repId", "stage", "source", "from", "to", "reviewed", "tracker"] as const) {
    const value = params.get(key)?.trim(); if (value) result[key] = value.slice(0, 200);
  }
  for (const key of ["from", "to"] as const) if (result[key] && !/^\d{4}-\d{2}-\d{2}$/.test(result[key]!)) throw new RevenueError("Use dates in YYYY-MM-DD format.");
  return result;
}

export async function visibleRepIds(auth: AuthUser): Promise<string[] | undefined> {
  if (auth.canViewAllCalls) return undefined;
  return (await listRepIdentities()).filter(rep => isOwnRep(rep, toCallViewer(auth))).map(rep => rep.id);
}

export async function searchConversations(auth: AuthUser, filters: ConversationFilters) {
  await ensureRevenueSchema();
  const own = await visibleRepIds(auth);
  const conditions: any[] = [scoped(calls), ...(own ? [inArray(calls.repId, own.length ? own : ["__no_access__"])] : [])];
  if (filters.q) conditions.push(or(...[calls.transcriptText, calls.prospectName, calls.prospectCompany, callMetadata.title, reps.name].map(column => sql`instr(lower(${column}), ${filters.q!.toLowerCase()}) > 0`)));
  if (filters.repId) conditions.push(eq(calls.repId, filters.repId));
  if (filters.stage) conditions.push(eq(calls.callStage, filters.stage));
  if (filters.source) conditions.push(sql`coalesce(${callMetadata.source}, 'upload') = ${filters.source}`);
  if (filters.from) conditions.push(gte(calls.createdAt, filters.from));
  if (filters.to) conditions.push(lte(calls.createdAt, `${filters.to}T23:59:59.999Z`));
  if (filters.reviewed === "yes") conditions.push(isNotNull(callMetadata.reviewedAt));
  if (filters.reviewed === "no") conditions.push(isNull(callMetadata.reviewedAt));
  if (filters.tracker) {
    const tracker = await db.select().from(conversationTrackers).where(and(scoped(conversationTrackers), eq(conversationTrackers.id, filters.tracker))).get();
    if (!tracker) throw new RevenueError("Tracker not found.", 404);
    conditions.push(or(...parseJson<string[]>(tracker.keywords, []).map(term => sql`instr(lower(${calls.transcriptText}), ${term.toLowerCase()}) > 0`)));
  }
  const where = and(...conditions);
  const total = await db.select({ count: sql<number>`count(*)` }).from(calls).leftJoin(callMetadata, eq(calls.id, callMetadata.callId)).leftJoin(reps, eq(calls.repId, reps.id)).where(where).get();
  const rows = await db.select({ id: calls.id, repId: calls.repId, repName: reps.name, title: callMetadata.title, prospectName: calls.prospectName, company: calls.prospectCompany,
    stage: calls.callStage, outcome: calls.coreOutcome, duration: calls.durationSeconds, status: calls.status, source: callMetadata.source, reviewedAt: callMetadata.reviewedAt, createdAt: calls.createdAt,
    snippet: filters.q ? sql<string>`substr(${calls.transcriptText}, max(1, instr(lower(${calls.transcriptText}), ${filters.q.toLowerCase()}) - 80), 240)` : sql<string>`substr(${calls.transcriptText}, 1, 180)` })
    .from(calls).leftJoin(callMetadata, eq(calls.id, callMetadata.callId)).leftJoin(reps, eq(calls.repId, reps.id)).where(where).orderBy(desc(calls.createdAt)).limit(25).offset(((filters.page || 1) - 1) * 25).all();
  return { rows, total: Number(total?.count || 0), page: filters.page || 1, pageSize: 25 };
}

export async function listTrackers() { await ensureRevenueSchema(); return (await db.select().from(conversationTrackers).where(scoped(conversationTrackers)).orderBy(asc(conversationTrackers.name)).all()).map((t: any) => ({ ...t, keywords: parseJson<string[]>(t.keywords, []) })); }
export async function listSearches(auth: AuthUser) { return (await db.select().from(savedSearches).where(and(scoped(savedSearches), eq(savedSearches.userId, actorId(auth)))).orderBy(asc(savedSearches.name)).all()).map((s: any) => ({ ...s, filters: parseJson<ConversationFilters>(s.filters, {}) })); }

export async function ensureMetadata(call: Call) {
  const orgId = currentTenantId();
  const segments = parseTranscript(call.transcriptText, call.durationSeconds).map((t, i, list): Segment => ({ speaker: t.speaker, text: t.text, start: t.timestampSeconds,
    end: list[i + 1]?.timestampSeconds || call.durationSeconds, timing: parseLeadingTimestamp(call.transcriptText.trim().split(/\r?\n/).filter(l => l.trim())[i] || "") ? "provider" : "estimated" }));
  await db.insert(callMetadata).values({ callId: call.id, orgId, title: `${call.prospectCompany} · ${call.callStage}`, segments: JSON.stringify(segments), createdAt: call.createdAt }).onConflictDoNothing().run();
  return db.select().from(callMetadata).where(and(scoped(callMetadata), eq(callMetadata.callId, call.id))).get();
}

export function conversationStats(segments: Segment[]) {
  const speakers: Record<string, { words: number; questions: number; turns: number }> = {};
  for (const turn of segments) { const stats = speakers[turn.speaker] ||= { words: 0, questions: 0, turns: 0 }; stats.words += turn.text.split(/\s+/).filter(Boolean).length; stats.questions += (turn.text.match(/\?/g) || []).length; stats.turns++; }
  const total = Object.values(speakers).reduce((n, s) => n + s.words, 0);
  return Object.entries(speakers).map(([name, s]) => ({ name, ...s, share: total ? Math.round(s.words / total * 100) : 0 }));
}

export function trackerHits(trackers: { id: string; name: string; keywords: string[] }[], segments: Segment[]) {
  return trackers.map(t => ({ id: t.id, name: t.name, hits: segments.flatMap(s => { const terms = t.keywords.filter(k => s.text.toLowerCase().includes(k.toLowerCase())); return terms.length ? [{ speaker: s.speaker, start: s.start, timing: s.timing, text: s.text, terms }] : []; }) })).filter(t => t.hits.length);
}

export async function conversationDetail(call: Call) {
  const meta = await ensureMetadata(call);
  const segments = parseJson<Segment[]>(meta.segments, []);
  const [comments, clips, overrides, trackers, linked] = await Promise.all([
    db.select().from(conversationComments).where(and(scoped(conversationComments), eq(conversationComments.callId, call.id))).orderBy(asc(conversationComments.createdAt)).all(),
    db.select().from(conversationClips).where(and(scoped(conversationClips), eq(conversationClips.callId, call.id))).orderBy(asc(conversationClips.startSeconds)).all(),
    db.select().from(scoreOverrides).where(and(scoped(scoreOverrides), eq(scoreOverrides.callId, call.id))).all(), listTrackers(),
    db.select().from(crmRecords).where(and(scoped(crmRecords), inArray(crmRecords.id, parseJson<string[]>(meta.crmRecordIds, []).length ? parseJson<string[]>(meta.crmRecordIds, []) : ["__none__"]))).all(),
  ]);
  const participants = parseJson<Participant[]>(meta.participants, []);
  const insights = await db.select().from(callProviderInsights).where(and(scoped(callProviderInsights), eq(callProviderInsights.callId, call.id))).get();
  return { ...meta, providerInsights: parseJson(insights?.data, null), participants, meetings: await meetingContextForCall(call, participants), actionItems: parseJson<ActionItem[]>(meta.actionItems, []), segments, comments, clips, overrides, trackers: trackerHits(trackers, segments), stats: conversationStats(segments), linked };
}

function seconds(value: unknown, max: number, required = true): number | null {
  if ((value === "" || value == null) && !required) return null;
  const n = Number(value); if (!Number.isFinite(n) || n < 0 || n > max) throw new RevenueError(`Timestamp must be between 0 and ${max} seconds.`); return Math.round(n);
}

export async function updateConversation(auth: AuthUser, call: Call, body: any) {
  const orgId = currentTenantId(); const actor = actorId(auth); const now = new Date().toISOString(); const meta = await ensureMetadata(call);
  let createdClipId: string | undefined;
  switch (body.action) {
    case "comment":
      await db.insert(conversationComments).values({ id: randomUUID(), orgId, callId: call.id, authorId: actor, authorName: actorName(auth), body: textInput(body.body, "Comment", 4000), timestampSeconds: seconds(body.timestamp, call.durationSeconds, false), createdAt: now }).run(); break;
    case "deleteComment":
      await db.delete(conversationComments).where(and(scoped(conversationComments), eq(conversationComments.callId, call.id), eq(conversationComments.id, String(body.id)), auth.isAdmin ? undefined : eq(conversationComments.authorId, actor))).run(); break;
    case "clip": {
      const start = seconds(body.start, call.durationSeconds)!; const end = seconds(body.end, call.durationSeconds)!;
      if (end <= start) throw new RevenueError("Clip end must be later than its start.");
      createdClipId = randomUUID();
      await db.insert(conversationClips).values({ id: createdClipId, orgId, callId: call.id, title: textInput(body.title, "Clip title"), collection: textInput(body.collection || "Examples", "Collection", 100), startSeconds: start, endSeconds: end, createdBy: actor, createdAt: now }).run(); break;
    }
    case "deleteClip":
      await db.delete(conversationClips).where(and(scoped(conversationClips), eq(conversationClips.callId, call.id), eq(conversationClips.id, String(body.id)), auth.isAdmin ? undefined : eq(conversationClips.createdBy, actor))).run(); break;
    case "review":
      if (!auth.isAdmin) throw new RevenueError("Only an admin can mark a call reviewed.", 403);
      await db.update(callMetadata).set({ reviewedAt: body.reviewed ? now : null, reviewedBy: body.reviewed ? actorName(auth) : null }).where(and(scoped(callMetadata), eq(callMetadata.callId, call.id))).run(); break;
    case "override": {
      if (!auth.isAdmin) throw new RevenueError("Only an admin can correct a score.", 403);
      const metricKey = textInput(body.metricKey, "Metric", 100); const score = Number(body.score);
      if (!Number.isInteger(score) || score < 1 || score > 10) throw new RevenueError("Score must be a whole number from 1 to 10.");

      let originalScore: number | null = null;
      let originalProbabilities: string | null = null;
      let clefModel: string | null = null;
      let rubricVersion: string = "1.0";
      let metadataStr: string | null = null;

      try {
        const evRow = await db.select().from(evaluations).where(and(scoped(evaluations), eq(evaluations.callId, call.id))).get();
        if (evRow) {
          const extended = parseExtendedReview(evRow.extendedReview);
          const metric = extended?.scorecard?.find((m) => m.key === metricKey);
          if (metric) {
            originalScore = metric.score;
            if (metric.probabilities) {
              originalProbabilities = JSON.stringify(metric.probabilities);
            }
          } else if (metricKey === "scriptAdherence") {
            originalScore = evRow.scriptAdherenceScore;
          }
          clefModel = extended?.clefMetadata?.model || (extended?.evaluatedWith?.provider === "clef" ? extended.evaluatedWith.model : null);
          rubricVersion = extended?.clefMetadata?.schemaVersion || "1.0";
          metadataStr = JSON.stringify({
            originalScore,
            originalStatus: metric?.status,
            originalProbabilities: metric?.probabilities,
            confidence: metric?.confidence,
            clefModel,
            rubricVersion,
            correctedAt: now,
            authorName: actorName(auth),
          });
        }
      } catch {
        // Tolerant if evaluation lookup is unavailable
      }

      const values = {
        id: stableId(orgId, call.id, metricKey),
        orgId,
        callId: call.id,
        metricKey,
        score,
        reason: textInput(body.reason, "Correction reason", 2000),
        authorName: actorName(auth),
        updatedAt: now,
        originalScore,
        originalProbabilities,
        clefModel,
        rubricVersion,
        metadata: metadataStr,
      };
      await db.insert(scoreOverrides).values(values).onConflictDoUpdate({ target: scoreOverrides.id, set: values }).run(); break;
    }
    case "removeOverride":
      if (!auth.isAdmin) throw new RevenueError("Only an admin can correct a score.", 403);
      await db.delete(scoreOverrides).where(and(scoped(scoreOverrides), eq(scoreOverrides.callId, call.id), eq(scoreOverrides.metricKey, String(body.metricKey)))).run(); break;
    case "addAction": {
      const items = parseJson<ActionItem[]>(meta.actionItems, []); if (items.length >= 100) throw new RevenueError("This call already has 100 action items.");
      items.push({ id: randomUUID(), description: textInput(body.description, "Action item", 1000), completed: false, assignee: textInput(body.assignee || "", "Assignee", 200, false) });
      await db.update(callMetadata).set({ actionItems: JSON.stringify(items) }).where(and(scoped(callMetadata), eq(callMetadata.callId, call.id))).run(); break;
    }
    case "toggleAction": {
      const items = parseJson<ActionItem[]>(meta.actionItems, []); const item = items.find(i => i.id === body.id); if (!item) throw new RevenueError("Action item not found.", 404); item.completed = Boolean(body.completed);
      await db.update(callMetadata).set({ actionItems: JSON.stringify(items) }).where(and(scoped(callMetadata), eq(callMetadata.callId, call.id))).run(); break;
    }
    case "linkDeal": {
      if (!auth.isAdmin) throw new RevenueError("Only an admin can change CRM links.", 403);
      const deal = await db.select().from(crmRecords).where(and(scoped(crmRecords), eq(crmRecords.id, String(body.id)), eq(crmRecords.kind, "deal"))).get();
      if (!deal) throw new RevenueError("Deal not found.", 404);
      const ids = new Set(parseJson<string[]>(meta.crmRecordIds, [])); if (body.remove) ids.delete(deal.id); else ids.add(deal.id);
      await db.update(callMetadata).set({ crmRecordIds: JSON.stringify([...ids]) }).where(and(scoped(callMetadata), eq(callMetadata.callId, call.id))).run(); break;
    }
    default: throw new RevenueError("Unknown conversation action.");
  }
  await audit(actor, `conversation.${body.action}`, call.id);
  if (body.action === "review" && body.reviewed && !meta.reviewedAt) await queueSlackAlerts("reviewed", call.id, now);
  if (body.action === "review" && body.reviewed && !meta.reviewedAt) {
    const { queueIntegrationEvents } = await import("./exports");
    await queueIntegrationEvents("call.reviewed", call.id, now);
  }
  if (createdClipId) await queueSlackAlerts("clip", call.id, createdClipId, createdClipId);
  return conversationDetail(call);
}

export async function createTracker(body: any, actor: string) {
  const keywords = (Array.isArray(body.keywords) ? body.keywords : String(body.keywords || "").split(",")).map((k: unknown) => textInput(k, "Keyword", 80));
  if (!keywords.length || keywords.length > 30) throw new RevenueError("Use between 1 and 30 keywords.");
  const id = randomUUID(); await db.insert(conversationTrackers).values({ id, orgId: currentTenantId(), name: textInput(body.name, "Tracker name"), keywords: JSON.stringify([...new Set(keywords)]), createdAt: new Date().toISOString() }).run();
  await audit(actor, "tracker.created", id); return id;
}

export async function saveSearch(auth: AuthUser, body: any) {
  const filters = readFilters(new URLSearchParams(body.filters || {})); delete filters.page;
  await db.insert(savedSearches).values({ id: randomUUID(), orgId: currentTenantId(), userId: actorId(auth), name: textInput(body.name, "Search name"), filters: JSON.stringify(filters), createdAt: new Date().toISOString() }).run();
}

export async function clipLibrary(auth: AuthUser) {
  const own = await visibleRepIds(auth);
  return db.select({ id: conversationClips.id, callId: conversationClips.callId, title: conversationClips.title, collection: conversationClips.collection, start: conversationClips.startSeconds, end: conversationClips.endSeconds, repName: reps.name, company: calls.prospectCompany, createdAt: conversationClips.createdAt }).from(conversationClips)
    .innerJoin(calls, eq(calls.id, conversationClips.callId)).innerJoin(reps, eq(reps.id, calls.repId)).where(and(scoped(conversationClips), scoped(calls), own ? inArray(calls.repId, own.length ? own : ["__none__"]) : undefined)).orderBy(desc(conversationClips.createdAt)).limit(200).all();
}

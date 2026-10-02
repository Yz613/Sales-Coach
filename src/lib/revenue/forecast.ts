import { createHash } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, ensureRevenueSchema } from "../db";
import { callMetadata, calls, dealReviews, forecastSubmissions } from "../db/schema";
import type { AuthUser } from "../auth";
import { currentTenantId } from "../tenant";
import { crmOverview } from "./crm";
import { audit } from "./connections";
import { RevenueError } from "./security";
import { parseJson, type ActionItem, type Participant, type Segment } from "./types";
import { buildForecast, currentQuarter, dealCurrency, emptyPlaybook, FORECAST_CATEGORIES, MEDDICC, periodBounds, validDate, type Evidence, type ForecastCategory, type ForecastFilters, type ForecastSnapshot } from "./forecast-model";

function admin(auth: AuthUser) { if (!auth.isAdmin) throw new RevenueError("Only workspace admins can manage deals and forecasts.", 403); }
function text(value: unknown, label: string, max: number): string {
  if (typeof value !== "string" || value.length > max) throw new RevenueError(`${label} must be text with at most ${max} characters.`);
  return value.trim();
}
function scopedId(kind: string, id: string) { return createHash("sha256").update(JSON.stringify([currentTenantId(), kind, id])).digest("hex"); }

export function forecastFilters(body: Record<string, unknown>): ForecastFilters {
  const period = body.period === undefined ? currentQuarter() : text(body.period, "Period", 7);
  try { periodBounds(period); } catch (err) { throw new RevenueError((err as Error).message); }
  return { period, owner: body.owner === undefined ? "" : text(body.owner, "Owner", 300), currency: body.currency === undefined ? "" : text(body.currency, "Currency", 40).toUpperCase().replace(/^UNSPECIFIED CURRENCY$/, "Unspecified currency") };
}

export async function dealDetail(auth: AuthUser, id: string) {
  admin(auth); await ensureRevenueSchema();
  const deal = (await crmOverview()).deals.find(d => d.id === id);
  if (!deal) throw new RevenueError("Deal not found.", 404);
  const rows: any[] = [];
  // D1 allows 100 bound parameters per statement; leave room for the tenant predicate.
  for (let offset = 0; offset < deal.linkedCalls.length; offset += 90) rows.push(...await db.select({ callId: callMetadata.callId, summary: callMetadata.summary, participants: callMetadata.participants, actions: callMetadata.actionItems }).from(callMetadata)
    .where(and(eq(callMetadata.orgId, currentTenantId()), inArray(callMetadata.callId, deal.linkedCalls.slice(offset, offset + 90).map(c => c.id)))).all());
  const stakeholders = new Map<string, { name: string; email: string; conversations: number; lastSeen: string }>();
  const actions: (ActionItem & { callId: string; callTitle: string })[] = [];
  const timeline = deal.linkedCalls.map(call => {
    const meta = rows.find((r: any) => r.callId === call.id);
    const seen = new Set<string>();
    for (const person of parseJson<Participant[]>(meta?.participants, []).filter(p => p.external)) {
      const key = person.email?.trim().toLowerCase() || person.name.trim().toLowerCase();
      if (!key || seen.has(key)) continue; seen.add(key);
      const previous = stakeholders.get(key);
      stakeholders.set(key, { name: person.name || person.email || "Unknown buyer", email: person.email || "", conversations: (previous?.conversations || 0) + 1, lastSeen: previous?.lastSeen || call.createdAt });
    }
    for (const action of parseJson<ActionItem[]>(meta?.actions, []).filter(a => !a.completed)) actions.push({ ...action, callId: call.id, callTitle: call.title });
    return { ...call, summary: meta?.summary || "" };
  });
  return { deal, timeline, stakeholders: [...stakeholders.values()], actions };
}

export async function dealEvidence(auth: AuthUser, id: string, callId: string) {
  const { deal } = await dealDetail(auth, id);
  if (!deal.linkedCalls.some(c => c.id === callId)) throw new RevenueError("Linked conversation not found.", 404);
  const row = await db.select({ segments: callMetadata.segments }).from(callMetadata).innerJoin(calls, eq(calls.id, callMetadata.callId))
    .where(and(eq(callMetadata.orgId, currentTenantId()), eq(calls.orgId, currentTenantId()), eq(calls.id, callId))).get();
  if (!row) throw new RevenueError("Linked conversation not found.", 404);
  return parseJson<Segment[]>(row.segments, []);
}

export async function saveDealReview(auth: AuthUser, id: string, body: Record<string, unknown>) {
  admin(auth); const { deal } = await dealDetail(auth, id);
  if (!Number.isInteger(body.revision) || Number(body.revision) < 0) throw new RevenueError("A valid review revision is required.");
  if (!FORECAST_CATEGORIES.includes(body.category as ForecastCategory)) throw new RevenueError("Choose a forecast category.");
  const probability = body.probability === null || body.probability === "" ? null : body.probability;
  if (probability !== null && (typeof probability !== "number" || !Number.isInteger(probability) || probability < 0 || probability > 100)) throw new RevenueError("Win probability must be an integer from 0 to 100, or empty.");
  const nextStep = text(body.nextStep, "Next step", 2000);
  const nextStepDate = body.nextStepDate === null || body.nextStepDate === "" ? null : text(body.nextStepDate, "Next step date", 10);
  if (nextStepDate && (!validDate(nextStepDate) || !nextStep)) throw new RevenueError("A next step date needs a valid date and a next step.");
  if (!body.playbook || typeof body.playbook !== "object" || Array.isArray(body.playbook)) throw new RevenueError("Supply the MEDDICC playbook.");
  const playbook = emptyPlaybook();
  const evidenceCache = new Map<string, Segment[]>();
  for (const { key, label } of MEDDICC) {
    const item = (body.playbook as Record<string, any>)[key];
    if (!item || !["unknown", "confirmed", "missing"].includes(item.status)) throw new RevenueError(`Choose a status for ${label}.`);
    const note = text(item.note, `${label} note`, 2000);
    let evidence: Evidence | null = null;
    if (item.evidence != null) {
      const callId = text(item.evidence.callId, "Evidence conversation", 300);
      const quote = text(item.evidence.quote, "Evidence quote", 10000);
      const start = item.evidence.start;
      if (typeof start !== "number" || !Number.isFinite(start) || start < 0 || !quote) throw new RevenueError("Choose a valid transcript moment.");
      if (!deal.linkedCalls.some(c => c.id === callId)) throw new RevenueError("Evidence must come from a conversation linked to this deal.");
      let segments = evidenceCache.get(callId);
      if (!segments) { segments = await dealEvidence(auth, id, callId); evidenceCache.set(callId, segments); }
      const segment = segments.find(s => s.start === start && s.text === item.evidence.quote);
      if (!segment) throw new RevenueError("This transcript moment has changed. Choose its evidence again.", 409);
      evidence = { callId, start, quote: segment.text };
    }
    if (item.status !== "unknown" && !note && !evidence) throw new RevenueError(`${label} needs a note or transcript evidence to support its status.`);
    playbook[key] = { status: item.status, note, evidence };
  }
  // Persist references and fingerprints only; deletion/retention never leaves a copied transcript quote.
  const storedPlaybook = Object.fromEntries(MEDDICC.map(({ key }) => {
    const item = playbook[key]; const e = item.evidence;
    return [key, { ...item, evidence: e ? { callId: e.callId, start: e.start, quoteHash: createHash("sha256").update(e.quote).digest("hex") } : null }];
  }));
  const values = { category: body.category as ForecastCategory, probability, nextStep, nextStepDate, playbook: JSON.stringify(storedPlaybook), revision: Number(body.revision) + 1, updatedBy: auth.userId || "local", updatedAt: new Date().toISOString() };
  const reviewId = scopedId("review", id); const orgId = currentTenantId();
  const changed = body.revision === 0
    ? await db.insert(dealReviews).values({ id: reviewId, orgId, dealId: id, ...values }).onConflictDoNothing().returning({ id: dealReviews.id }).all()
    : await db.update(dealReviews).set(values).where(and(eq(dealReviews.id, reviewId), eq(dealReviews.orgId, orgId), eq(dealReviews.dealId, id), eq(dealReviews.revision, Number(body.revision)))).returning({ id: dealReviews.id }).all();
  if (!changed.length) throw new RevenueError("Another manager updated this review. Reload the latest review before saving.", 409);
  await audit(auth.userId || "local", "deal.review.saved", id);
  return (await dealDetail(auth, id)).deal.review;
}

export interface ForecastSubmission {
  id: string; period: string; owner: string; currency: string; target: string | null; notes: string;
  snapshot: ForecastSnapshot; createdBy: string; createdAt: string;
}
function submission(row: any): ForecastSubmission {
  const { id, period, owner, currency, target, notes, createdBy, createdAt } = row;
  return { id, period, owner, currency, target, notes, createdBy, createdAt, snapshot: parseJson<ForecastSnapshot>(row.snapshot, { totals: [], deals: [], undatedDeals: 0, generatedAt: createdAt }) };
}
export async function forecastWorkspace(auth: AuthUser, input: Record<string, unknown>) {
  admin(auth); await ensureRevenueSchema(); const filters = forecastFilters(input);
  const { deals } = await crmOverview();
  const history: any[] = await db.select().from(forecastSubmissions).where(and(eq(forecastSubmissions.orgId, currentTenantId()), eq(forecastSubmissions.period, filters.period), eq(forecastSubmissions.owner, filters.owner), eq(forecastSubmissions.currency, filters.currency))).orderBy(desc(forecastSubmissions.createdAt)).limit(20).all();
  const savedScopes: { owner: string; currency: string }[] = await db.selectDistinct({ owner: forecastSubmissions.owner, currency: forecastSubmissions.currency }).from(forecastSubmissions).where(eq(forecastSubmissions.orgId, currentTenantId())).all();
  return { filters, snapshot: buildForecast(deals, filters), history: history.map(submission),
    owners: [...new Set([...deals.map(d => d.owner || "Unassigned"), ...savedScopes.map(s => s.owner), filters.owner].filter(Boolean))].sort(),
    currencies: [...new Set([...deals.map(dealCurrency), ...savedScopes.map(s => s.currency), filters.currency].filter(Boolean))].sort() };
}

export async function submitForecast(auth: AuthUser, body: Record<string, unknown>) {
  admin(auth); await ensureRevenueSchema(); const filters = forecastFilters(body);
  const requestId = text(body.requestId, "Submission ID", 36);
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(requestId)) throw new RevenueError("Supply a valid submission ID.");
  const notes = body.notes === undefined ? "" : text(body.notes, "Forecast notes", 4000);
  const target = body.target == null || body.target === "" ? null : body.target;
  if (target !== null && (typeof target !== "number" || !Number.isFinite(target) || target < 0 || target > 1e12 || !filters.currency || filters.currency === "Unspecified currency")) throw new RevenueError("A target needs a known single currency and an amount between 0 and 1 trillion.");
  const id = scopedId("forecast", requestId); const orgId = currentTenantId();
  const existing = await db.select().from(forecastSubmissions).where(and(eq(forecastSubmissions.id, id), eq(forecastSubmissions.orgId, orgId))).get();
  if (existing) {
    if (existing.period !== filters.period || existing.owner !== filters.owner || existing.currency !== filters.currency || existing.notes !== notes || existing.target !== (target === null ? null : String(target))) throw new RevenueError("This submission ID was already used. Refresh before submitting a changed forecast.", 409);
    return submission(existing); // Retry returns the original immutable snapshot.
  }
  const { snapshot } = await forecastWorkspace(auth, { ...filters });
  await db.insert(forecastSubmissions).values({ id, orgId, ...filters, target: target === null ? null : String(target), notes,
    snapshot: JSON.stringify(snapshot), createdBy: auth.userId || "local", createdAt: new Date().toISOString() }).onConflictDoNothing().run();
  const saved = await db.select().from(forecastSubmissions).where(and(eq(forecastSubmissions.id, id), eq(forecastSubmissions.orgId, orgId))).get();
  if (saved.period !== filters.period || saved.owner !== filters.owner || saved.currency !== filters.currency || saved.notes !== notes || saved.target !== (target === null ? null : String(target))) throw new RevenueError("This submission ID was already used. Refresh before submitting a changed forecast.", 409);
  await audit(auth.userId || "local", "forecast.submitted", id);
  return submission(saved);
}

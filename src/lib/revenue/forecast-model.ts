/** Forecast probabilities are manager estimates, not a trained win prediction. */
export const FORECAST_CATEGORIES = ["pipeline", "best_case", "commit", "omitted"] as const;
export type ForecastCategory = typeof FORECAST_CATEGORIES[number];
export const CATEGORY_LABELS: Record<ForecastCategory, string> = { pipeline: "Pipeline", best_case: "Best case", commit: "Commit", omitted: "Omitted" };
export const MEDDICC = [
  { key: "metrics", label: "Metrics", prompt: "What measurable business outcome does the buyer need?" },
  { key: "economicBuyer", label: "Economic buyer", prompt: "Who has final budget authority?" },
  { key: "decisionCriteria", label: "Decision criteria", prompt: "What will the buyer use to compare solutions?" },
  { key: "decisionProcess", label: "Decision process", prompt: "Which approvals and dates lead to a decision?" },
  { key: "pain", label: "Identify pain", prompt: "What problem is urgent enough to change?" },
  { key: "champion", label: "Champion", prompt: "Who is advocating for you internally?" },
  { key: "competition", label: "Competition", prompt: "Which alternatives, including doing nothing, are in play?" },
] as const;
export type PlaybookKey = typeof MEDDICC[number]["key"];
export interface Evidence { callId: string; start: number; quote: string }
export interface EvidenceRef { callId: string; start: number; quoteHash: string }
export interface Qualification { status: "unknown" | "confirmed" | "missing"; note: string; evidence: Evidence | null }
export type Playbook = Record<PlaybookKey, Qualification>;
export interface DealReview {
  category: ForecastCategory; probability: number | null; nextStep: string; nextStepDate: string | null;
  playbook: Playbook; revision: number; updatedBy: string | null; updatedAt: string | null;
}
export interface DealSummary {
  id: string; name: string; stage: string | null; pipeline: string | null; owner: string | null;
  amount: string | null; currency: string | null; closeDate: string | null; closed: boolean; won: boolean;
  syncedAt: string; risks: string[]; review: DealReview;
  linkedCalls: { id: string; title: string; createdAt: string; stage: string }[];
  associated: { id: string; name: string; kind: string; email: string | null }[]; openActions: number;
}
export interface ForecastFilters { period: string; owner: string; currency: string }
export interface CurrencyForecast {
  currency: string; won: number; pipeline: number; bestCase: number; commit: number; omitted: number;
  weighted: number; committed: number; upside: number; open: number; deals: number;
  missingAmounts: number; missingProbabilities: number;
}
export interface ForecastSnapshot {
  totals: CurrencyForecast[]; deals: ForecastDeal[]; undatedDeals: number; generatedAt: string;
}
export type ForecastDeal = Pick<DealSummary, "id" | "name" | "stage" | "owner" | "amount" | "currency" | "closeDate" | "closed" | "won" | "risks"> & { review: Pick<DealReview, "category" | "probability" | "revision"> };

export function emptyPlaybook(): Playbook {
  return Object.fromEntries(MEDDICC.map(({ key }) => [key, { status: "unknown", note: "", evidence: null }])) as Playbook;
}
export function defaultReview(): DealReview {
  return { category: "pipeline", probability: null, nextStep: "", nextStepDate: null, playbook: emptyPlaybook(), revision: 0, updatedBy: null, updatedAt: null };
}
export function storedReview(row: { category: ForecastCategory; probability: number | null; nextStep: string; nextStepDate: string | null; playbook: string; revision: number; updatedBy: string; updatedAt: string } | undefined, resolveEvidence: (e: EvidenceRef) => Evidence | null): DealReview {
  if (!row) return defaultReview();
  let stored: Partial<Record<PlaybookKey, Omit<Qualification, "evidence"> & { evidence: EvidenceRef | null }>> = {};
  try { stored = JSON.parse(row.playbook) || {}; } catch { /* Older malformed data starts with an empty playbook. */ }
  const playbook = emptyPlaybook();
  for (const { key } of MEDDICC) {
    const item = stored[key];
    if (!item) continue;
    const evidence = item.evidence ? resolveEvidence(item.evidence) : null;
    const valid = !item.evidence || !!evidence;
    // Deleted, changed, or unlinked transcripts must not survive as quoted evidence.
    playbook[key] = { status: valid ? item.status : "unknown", note: item.note, evidence };
  }
  const { category, probability, nextStep, nextStepDate, revision, updatedBy, updatedAt } = row;
  return { category, probability, nextStep, nextStepDate, revision, updatedBy, updatedAt, playbook };
}
export function currentQuarter(now = new Date()): string {
  return `${now.getUTCFullYear()}-Q${Math.floor(now.getUTCMonth() / 3) + 1}`;
}
export function periodBounds(period: string): { from: string; to: string } {
  // Assumption: reporting uses calendar months/quarters and the CRM's close-date day.
  const match = /^(\d{4})-(?:Q([1-4])|(0[1-9]|1[0-2]))$/.exec(period);
  if (!match || Number(match[1]) < 2000 || Number(match[1]) > 2100) throw new Error("Choose a month (YYYY-MM) or quarter (YYYY-Q1 through Q4) between 2000 and 2100.");
  const year = Number(match[1]); const month = match[2] ? (Number(match[2]) - 1) * 3 : Number(match[3]) - 1;
  return { from: new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10), to: new Date(Date.UTC(year, month + (match[2] ? 3 : 1), 1)).toISOString().slice(0, 10) };
}
export function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function dealCurrency(deal: Pick<DealSummary, "currency">): string { return deal.currency?.trim().toUpperCase() || "Unspecified currency"; }
export function amountValue(value: string | null): number | null {
  if (value === null || !value.trim()) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 && amount <= 1e12 ? amount : null;
}
export function buildForecast(deals: DealSummary[], filters: ForecastFilters, now = new Date()): ForecastSnapshot {
  const { from, to } = periodBounds(filters.period);
  const scoped = deals.filter(d => (!filters.owner || (d.owner || "Unassigned") === filters.owner) && (!filters.currency || dealCurrency(d) === filters.currency));
  const inPeriod = scoped.filter(d => {
    const date = d.closeDate?.slice(0, 10);
    return date && validDate(date) && date >= from && date < to && (!d.closed || d.won);
  });
  const totals = new Map<string, CurrencyForecast>();
  for (const deal of inPeriod) {
    const currency = dealCurrency(deal);
    let total = totals.get(currency);
    if (!total) { total = { currency, won: 0, pipeline: 0, bestCase: 0, commit: 0, omitted: 0, weighted: 0, committed: 0, upside: 0, open: 0, deals: 0, missingAmounts: 0, missingProbabilities: 0 }; totals.set(currency, total); }
    total.deals++;
    const amount = amountValue(deal.amount);
    if (amount === null) total.missingAmounts++;
    if (deal.closed) { total.won += amount ?? 0; total.weighted += amount ?? 0; continue; }
    const category = deal.review.category;
    total[category === "best_case" ? "bestCase" : category] += amount ?? 0;
    if (category !== "omitted") {
      total.open += amount ?? 0;
      if (deal.review.probability === null) total.missingProbabilities++;
      else total.weighted += (amount ?? 0) * deal.review.probability / 100;
    }
  }
  for (const total of totals.values()) {
    total.committed = total.won + total.commit;
    total.upside = total.committed + total.bestCase;
    for (const key of ["won", "pipeline", "bestCase", "commit", "omitted", "weighted", "committed", "upside", "open"] as const) total[key] = Math.round(total[key] * 100) / 100;
  }
  return { totals: [...totals.values()].sort((a, b) => a.currency.localeCompare(b.currency)), deals: inPeriod.map(d => ({
    id: d.id, name: d.name, stage: d.stage, owner: d.owner, amount: amountValue(d.amount) === null ? null : d.amount, currency: d.currency,
    closeDate: d.closeDate, closed: d.closed, won: d.won, risks: d.risks,
    review: { category: d.review.category, probability: d.review.probability, revision: d.review.revision },
  })),
    undatedDeals: scoped.filter(d => !d.closed && (!d.closeDate || !validDate(d.closeDate.slice(0, 10)))).length,
    generatedAt: now.toISOString() };
}

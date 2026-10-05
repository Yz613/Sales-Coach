/** Pure scorecard rules. No database access, so the call review and admin screens can share them. */

export const SCORE_SCALES = ["pass_fail", "scale_5"] as const;
export type ScoreScale = (typeof SCORE_SCALES)[number];

export const SCORE_VISIBILITY = ["managers", "managers_and_rep", "call_viewers"] as const;
export type ScoreVisibility = (typeof SCORE_VISIBILITY)[number];

export const VISIBILITY_OPTIONS: { id: ScoreVisibility; label: string; detail: string }[] = [
  { id: "managers", label: "Managers", detail: "Workspace admins only" },
  { id: "managers_and_rep", label: "Managers and the rep", detail: "Admins and the rep on the call" },
  { id: "call_viewers", label: "Anyone who can open the call", detail: "Same people who can already open the conversation" },
];

export const RUBRIC_LINKS: { key: string; label: string }[] = [
  { key: "pain", label: "Pain" },
  { key: "budget", label: "Budget" },
  { key: "decision", label: "Decision" },
  { key: "scriptAdherence", label: "Script adherence" },
  { key: "fightForTheWin", label: "Fight for the win" },
  { key: "nextStep", label: "Next step" },
  { key: "discoveryDepth", label: "Discovery depth" },
  { key: "controlAndPacing", label: "Control and pacing" },
  { key: "peerAuthority", label: "Peer authority" },
];

export const SCORECARD_SOURCES: { id: string; label: string }[] = [
  { id: "upload", label: "Upload" },
  { id: "fathom", label: "Fathom" },
  { id: "fireflies", label: "Fireflies" },
  { id: "tldv", label: "tl;dv" },
  { id: "gong", label: "Gong" },
  { id: "close", label: "Close" },
  { id: "aircall", label: "Aircall" },
  { id: "zoom", label: "Zoom" },
  { id: "google-meet", label: "Google Meet" },
  { id: "microsoft-teams", label: "Microsoft Teams" },
  { id: "zapier", label: "Zapier" },
  { id: "make", label: "Make" },
];

export interface ScorecardFilters {
  teams: string[];
  stages: string[];
  sources: string[];
}

export interface ScoredQuestion {
  scale: ScoreScale;
  value: string | null;
  /** Blank weight counts as 1. */
  weight: number | null;
}

export interface RubricSignal {
  score: number | null;
  status: string | null;
}

const EMPTY_FILTERS: ScorecardFilters = { teams: [], stages: [], sources: [] };

function cleanList(value: unknown, max = 40): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const text = entry.trim().replace(/\s+/g, " ");
    if (!text || text.length > 80 || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    result.push(text);
    if (result.length >= max) break;
  }
  return result;
}

export function parseFilters(raw: unknown): ScorecardFilters {
  let value = raw;
  if (typeof raw === "string") {
    try { value = JSON.parse(raw); } catch { return { ...EMPTY_FILTERS }; }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...EMPTY_FILTERS };
  const record = value as Record<string, unknown>;
  return {
    teams: cleanList(record.teams),
    stages: cleanList(record.stages),
    sources: cleanList(record.sources),
  };
}

export function isScoreScale(value: unknown): value is ScoreScale {
  return value === "pass_fail" || value === "scale_5";
}

export function isScoreVisibility(value: unknown): value is ScoreVisibility {
  return value === "managers" || value === "managers_and_rep" || value === "call_viewers";
}

/** 0–100 points for one answer. Pass is 100, fail is 0, and a 1–5 rating is that number divided by 5. */
export function pointsForAnswer(scale: ScoreScale, value: string | null | undefined): number | null {
  if (!value) return null;
  if (scale === "pass_fail") {
    if (value === "pass") return 100;
    if (value === "fail") return 0;
    return null;
  }
  const rating = Number(value);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return null;
  return (rating / 5) * 100;
}

export function answerFitsScale(scale: ScoreScale, value: string | null | undefined): boolean {
  return pointsForAnswer(scale, value) != null;
}

/**
 * Weighted average of answered questions, 0–100 with one decimal.
 * Unanswered questions are left out until a manager scores them.
 * A blank weight counts as 1.
 */
export function weightedOverall(items: ScoredQuestion[]): number | null {
  let weighted = 0;
  let total = 0;
  for (const item of items) {
    const points = pointsForAnswer(item.scale, item.value);
    if (points == null) continue;
    const weight = item.weight == null ? 1 : item.weight;
    if (!(weight > 0)) continue;
    weighted += points * weight;
    total += weight;
  }
  if (total <= 0) return null;
  return Math.round((weighted / total) * 10) / 10;
}

export function callMatchesFilters(
  filters: ScorecardFilters,
  call: { stage: string; source: string; teamIds: string[] },
): boolean {
  const same = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();
  if (filters.teams.length && !filters.teams.some((id) => call.teamIds.includes(id))) return false;
  if (filters.stages.length && !filters.stages.some((stage) => same(stage, call.stage))) return false;
  if (filters.sources.length && !filters.sources.some((source) => same(source, call.source || "upload"))) return false;
  return true;
}

export function canViewScorecard(
  visibility: ScoreVisibility,
  viewer: { manager: boolean; callRep: boolean },
): boolean {
  if (viewer.manager) return true;
  if (visibility === "managers") return false;
  if (visibility === "managers_and_rep") return viewer.callRep;
  return true;
}

/** Map a coaching rubric result onto a structured question. A 1–10 score of 7 or more is a pass. */
export function answerFromRubric(scale: ScoreScale, signal: RubricSignal | undefined): string | null {
  if (!signal) return null;
  let score = signal.score;
  if (score == null && signal.status) {
    if (signal.status === "Pass") score = 9;
    else if (signal.status === "Incomplete") score = 5;
    else if (signal.status === "Fail") score = 2;
    else return null;
  }
  if (score == null || !Number.isFinite(score)) return null;
  if (scale === "pass_fail") return score >= 7 ? "pass" : "fail";
  return String(Math.max(1, Math.min(5, Math.round(score / 2))));
}

/** Map a structured answer back onto the coaching scorecard's 1–10 scale. */
export function coachingScoreFromAnswer(scale: ScoreScale, value: string): number | null {
  if (scale === "pass_fail") {
    if (value === "pass") return 10;
    if (value === "fail") return 2;
    return null;
  }
  const rating = Number(value);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return null;
  return rating * 2;
}

export function formatOverall(score: number | null | undefined): string {
  if (score == null || !Number.isFinite(score)) return "Not scored";
  return score.toFixed(1);
}

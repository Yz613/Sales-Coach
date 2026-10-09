/**
 * Full-funnel dial math.
 * Every logged attempt is a dial. Connect and close rates use that full denominator,
 * so missed calls and voicemails lower the rate instead of disappearing from it.
 *
 * A later funnel stage is always a subset of the one before it.
 * Closes are closed-won only. Closed-lost still counts as a connect, a conversation,
 * and a meeting, and it does not count as a close.
 */

export const DIAL_OUTCOMES = [
  { key: "no_answer", label: "No answer / missed", short: "No answer" },
  { key: "voicemail", label: "Voicemail", short: "Voicemail" },
  { key: "connected_not_interested", label: "Connected, not interested", short: "Not interested" },
  { key: "connected_interested", label: "Connected, interested", short: "Interested" },
  { key: "meeting_booked", label: "Meeting booked", short: "Meeting" },
  { key: "closed_won", label: "Closed won", short: "Won" },
  { key: "closed_lost", label: "Closed lost", short: "Lost" },
] as const;

export type DialOutcome = (typeof DIAL_OUTCOMES)[number]["key"];

export const FUNNEL_STAGES = [
  { key: "dials", label: "Dials" },
  { key: "connects", label: "Connects" },
  { key: "conversations", label: "Conversations" },
  { key: "meetings", label: "Meetings" },
  { key: "closes", label: "Closes" },
] as const;

export type FunnelStageKey = (typeof FUNNEL_STAGES)[number]["key"];

/** 0 dial only, 1 connect, 2 conversation, 3 meeting, 4 close (won). */
const DIAL_RANK: Record<DialOutcome, 0 | 1 | 2 | 3 | 4> = {
  no_answer: 0,
  voicemail: 0,
  connected_not_interested: 1,
  connected_interested: 2,
  meeting_booked: 3,
  closed_lost: 3,
  closed_won: 4,
};

export interface DialFunnelStep {
  key: FunnelStageKey;
  label: string;
  count: number;
  /** This stage divided by dials, as a percent. */
  rateFromStart: number;
  /** This stage divided by the previous stage, as a percent. */
  rateFromPrevious: number;
}

export interface DialRateSummary {
  dials: number;
  connects: number;
  conversations: number;
  meetings: number;
  closes: number;
  /** Connects / dials, percent. */
  connectRate: number;
  /** Closes / dials, percent. This is the close rate. */
  closeRate: number;
  /** Closes / connects, percent. Labeled separately from the close rate. */
  closePerConnect: number;
  steps: DialFunnelStep[];
  outcomes: { key: DialOutcome; label: string; count: number }[];
}

export interface DialFact {
  dialOutcome?: string | null;
  coreOutcome?: string | null;
  /** False when the row has no conversation to coach (a miss, a voicemail, or an empty upload). */
  hasConversation?: boolean;
}

const QUICK_LOG_NOTE = "No transcript. Dial logged from the one-tap outcome list.";

export function dialLogTranscript(): string {
  return QUICK_LOG_NOTE;
}

export function isDialOutcome(value: unknown): value is DialOutcome {
  return DIAL_OUTCOMES.some((item) => item.key === value);
}

export function dialOutcomeLabel(outcome: DialOutcome): string {
  return DIAL_OUTCOMES.find((item) => item.key === outcome)?.label || outcome;
}

export function dialOutcomeShort(outcome: DialOutcome): string {
  return DIAL_OUTCOMES.find((item) => item.key === outcome)?.short || outcome;
}

function matchDialOutcome(raw: string): DialOutcome | null {
  const text = raw.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  if (!text) return null;
  const exact = DIAL_OUTCOMES.find((item) => item.key.replace(/_/g, " ") === text || item.label.toLowerCase() === text || item.short.toLowerCase() === text);
  if (exact) return exact.key;
  if (/\b(no answer|no-answer|missed|did not answer|didn't answer|unanswered)\b/.test(text)) return "no_answer";
  if (/\bvoicemail\b|\bvoice mail\b|\bleft a message\b/.test(text)) return "voicemail";
  if (/\bclosed won\b|\bwon the deal\b/.test(text)) return "closed_won";
  if (/\bclosed lost\b|\blost the deal\b/.test(text)) return "closed_lost";
  if (/\bnot interested\b|\buninterested\b/.test(text)) return "connected_not_interested";
  if (/\bconnected, interested\b|\binterested\b/.test(text) && !/\bnot interested\b/.test(text)) return "connected_interested";
  if (text === "meeting booked" || text === "meeting") return "meeting_booked";
  return null;
}

/** Map a stored dial outcome, or an older coaching outcome, onto the funnel. */
export function resolveDialOutcome(fact: DialFact): DialOutcome {
  const explicit = matchDialOutcome(String(fact.dialOutcome || ""));
  if (explicit) return explicit;

  const legacy = String(fact.coreOutcome || "").trim().toLowerCase();
  const labeled = matchDialOutcome(legacy);
  if (labeled) return labeled;

  const connected = fact.hasConversation !== false && legacy.length > 0 && !/analyz|evaluation failed/.test(legacy);
  if (!legacy || /analyz|evaluation failed/.test(legacy)) {
    return fact.hasConversation ? "connected_not_interested" : "no_answer";
  }
  if (legacy.includes("meeting booked") || legacy.includes("calendar lock") || legacy.includes("reschedul")) return "meeting_booked";
  if (legacy.includes("closed won") || legacy === "won") return "closed_won";
  if (legacy.includes("closed lost") || legacy === "lost") return "closed_lost";
  if (legacy.includes("demo") || legacy.includes("negotiat")) return "connected_interested";
  if (legacy.includes("drop") || legacy.includes("unqualif") || legacy.includes("no fit") || legacy.includes("fold")) {
    return connected ? "connected_not_interested" : "no_answer";
  }
  return connected ? "connected_not_interested" : "no_answer";
}

export function percentOf(part: number, whole: number): number {
  if (whole <= 0 || part <= 0) return 0;
  return (part / whole) * 100;
}

export function formatRate(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0%";
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

export function emptyDialRates(): DialRateSummary {
  return tallyDialFunnel([]);
}

/** Count funnel stages and the three rates managers compare. */
export function tallyDialFunnel(facts: DialFact[]): DialRateSummary {
  const counts = [0, 0, 0, 0, 0];
  const byOutcome = new Map<DialOutcome, number>(DIAL_OUTCOMES.map((item) => [item.key, 0]));
  for (const fact of facts) {
    const outcome = resolveDialOutcome(fact);
    byOutcome.set(outcome, (byOutcome.get(outcome) || 0) + 1);
    const rank = DIAL_RANK[outcome];
    for (let stage = 0; stage <= rank; stage += 1) counts[stage] += 1;
  }
  const [dials, connects, conversations, meetings, closes] = counts;
  const steps: DialFunnelStep[] = FUNNEL_STAGES.map((stage, index) => {
    const count = counts[index];
    const previous = index === 0 ? count : counts[index - 1];
    return {
      key: stage.key,
      label: stage.label,
      count,
      rateFromStart: percentOf(count, dials),
      rateFromPrevious: percentOf(count, previous),
    };
  });
  return {
    dials,
    connects,
    conversations,
    meetings,
    closes,
    connectRate: percentOf(connects, dials),
    closeRate: percentOf(closes, dials),
    closePerConnect: percentOf(closes, connects),
    steps,
    outcomes: DIAL_OUTCOMES.map((item) => ({ key: item.key, label: item.label, count: byOutcome.get(item.key) || 0 })),
  };
}

/** Build the five funnel bars from stage counts already stored on a rep. */
export function funnelStepsFromCounts(counts: {
  dials: number;
  connects: number;
  conversations: number;
  meetings: number;
  closes: number;
}): DialFunnelStep[] {
  const values = [counts.dials, counts.connects, counts.conversations, counts.meetings, counts.closes];
  return FUNNEL_STAGES.map((stage, index) => {
    const count = values[index];
    const previous = index === 0 ? count : values[index - 1];
    return {
      key: stage.key,
      label: stage.label,
      count,
      rateFromStart: percentOf(count, counts.dials),
      rateFromPrevious: percentOf(count, previous),
    };
  });
}

export function dialFactsFromOutcomes(outcomes: DialOutcome[]): DialFact[] {
  return outcomes.map((outcome) => ({ dialOutcome: outcome, hasConversation: DIAL_RANK[outcome] > 0 }));
}

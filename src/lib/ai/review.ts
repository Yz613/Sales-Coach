import type { MissedOpportunity, SandlerStatus } from "@/types";
import { findTurnForQuote, parseTranscript, type TranscriptTurn } from "../transcript";

export type ScorecardKey =
  | "pain"
  | "budget"
  | "decision"
  | "fightForTheWin"
  | "nextStep"
  | "discoveryDepth"
  | "controlAndPacing"
  | "peerAuthority";

export type WalkthroughVerdict = "good" | "coach" | "miss" | "fatal";

export interface TranscriptCite {
  timestamp: string;
  timestampSeconds: number;
  quote: string;
}

export interface ScorecardMetric {
  key: ScorecardKey;
  label: string;
  status: SandlerStatus;
  score: number;
  evidence: string;
  cite?: TranscriptCite;
}

export interface CoachWalkthroughStep {
  step: number;
  timestamp: string;
  timestampSeconds: number;
  speaker: string;
  quote: string;
  whatHappened: string;
  shouldHaveDone: string;
  verdict: WalkthroughVerdict;
  category: string;
}

export interface EvaluatedWith {
  provider: string;
  model: string;
  estimatedCostUsd?: number;
  /** Present when the LLM call failed and the rule engine produced this score. */
  fallback?: "rules";
  error?: string;
}

export interface ExtendedReview {
  scorecard: ScorecardMetric[];
  walkthrough: CoachWalkthroughStep[];
  evaluatedWith?: EvaluatedWith;
}

export const SCORECARD_LABELS: Record<ScorecardKey, string> = {
  pain: "Pain",
  budget: "Budget",
  decision: "Decision",
  fightForTheWin: "Fight for the Win",
  nextStep: "Next-step firmness",
  discoveryDepth: "Discovery depth",
  controlAndPacing: "Control & pacing",
  peerAuthority: "Peer authority",
};

export const SCORECARD_KEYS: ScorecardKey[] = [
  "pain",
  "budget",
  "decision",
  "fightForTheWin",
  "nextStep",
  "discoveryDepth",
  "controlAndPacing",
  "peerAuthority",
];

export function emptyScorecard(): ScorecardMetric[] {
  return SCORECARD_KEYS.map((key) => ({
    key,
    label: SCORECARD_LABELS[key],
    status: "Incomplete" as SandlerStatus,
    score: 5,
    evidence: "",
  }));
}

export function parseExtendedReview(raw: string | null | undefined): ExtendedReview | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return undefined;
    if (!Array.isArray(parsed.scorecard) && !Array.isArray(parsed.walkthrough)) return undefined;
    return {
      scorecard: Array.isArray(parsed.scorecard) ? parsed.scorecard : [],
      walkthrough: Array.isArray(parsed.walkthrough) ? parsed.walkthrough : [],
      evaluatedWith: parsed.evaluatedWith,
    };
  } catch {
    return undefined;
  }
}

export function stampMissedOpportunities(
  opportunities: MissedOpportunity[],
  transcriptText: string,
  durationSeconds: number
): MissedOpportunity[] {
  const turns = parseTranscript(transcriptText, durationSeconds);
  return opportunities.map((opp) => {
    if (opp.timestamp && opp.repQuote) return opp;
    const prospectTurn = findTurnForQuote(turns, opp.prospectOpening);
    const repTurn = findTurnForQuote(turns, opp.repSurrender);
    const stampTurn = repTurn || prospectTurn;
    return {
      ...opp,
      timestamp: opp.timestamp || stampTurn?.timestamp,
      timestampSeconds: opp.timestampSeconds ?? stampTurn?.timestampSeconds,
      prospectQuote: opp.prospectQuote || prospectTurn?.text || opp.prospectOpening,
      repQuote: opp.repQuote || (isNonSurrender(opp.repSurrender) ? undefined : repTurn?.text || opp.repSurrender),
    };
  });
}

function isNonSurrender(text: string): boolean {
  const t = (text || "").toLowerCase();
  return t.startsWith("none") || t.includes("leaned in") || t.includes("handled cleanly");
}

const FOLD_MARKERS = [
  "send an email",
  "i'll send",
  "i will send",
  "no problem",
  "absolutely",
  "have a great day",
  "keep us in mind",
  "no worries",
  "i'll email",
  "send that right",
];

function looksLikeFold(text: string): boolean {
  const t = text.toLowerCase();
  return FOLD_MARKERS.some((m) => t.includes(m));
}

function classifyTurn(turn: TranscriptTurn, isRep: boolean): { category: string; verdict: WalkthroughVerdict; shouldHaveDone: string; whatHappened: string } | null {
  const t = turn.text.toLowerCase();

  if (isRep && turn.index === 0) {
    if (t.includes("how are you") || t.includes("excited to show")) {
      return {
        category: "Opener",
        verdict: "miss",
        whatHappened: "Opened like a vendor instead of earning permission.",
        shouldHaveDone: "Lead with name, company, and a 30-second permission interrupt. Do not ask 'how are you' or jump to a demo.",
      };
    }
    if (t.includes("30 seconds") || t.includes("bad time") || t.includes("fair agenda")) {
      return {
        category: "Opener",
        verdict: "good",
        whatHappened: "Opened with a controlled, permission-based frame.",
        shouldHaveDone: "",
      };
    }
  }

  if (!isRep && (t.includes("already") || t.includes("we're set") || t.includes("don't need") || t.includes("send me an email") || t.includes("send the pdf") || t.includes("no budget"))) {
    return {
      category: "Objection",
      verdict: "coach",
      whatHappened: "Prospect offered a brush-off or stall — this is the moment to fight for the next 60 seconds.",
      shouldHaveDone: "Acknowledge, then ask one specific operational question instead of accepting the stall.",
    };
  }

  if (isRep && looksLikeFold(turn.text)) {
    return {
      category: "Early fold",
      verdict: "fatal",
      whatHappened: "Rep accepted the brush-off and surrendered the call.",
      shouldHaveDone: "Do not say yes to 'send info'. Acknowledge the request, then ask for 60 seconds to test fit before hanging up.",
    };
  }

  if (isRep && (t.includes("let me pull up") || t.includes("jump right into the demo") || t.includes("slides"))) {
    return {
      category: "Demo harbor",
      verdict: "miss",
      whatHappened: "Jumped into product before qualifying pain, budget, or decision.",
      shouldHaveDone: "Park the demo. Ask what the 14-step (or stated) pain costs them, who owns budget, and who else signs off.",
    };
  }

  return null;
}

/** Build a coach-friendly beat-by-beat walkthrough from the transcript + flagged surrenders. */
export function buildWalkthroughFromTranscript(
  transcriptText: string,
  durationSeconds: number,
  missed: MissedOpportunity[] = [],
  repName = "Rep"
): CoachWalkthroughStep[] {
  const turns = parseTranscript(transcriptText, durationSeconds);
  if (turns.length === 0) return [];

  const repFirst = (repName || "").split(" ")[0]?.toLowerCase();
  const steps: CoachWalkthroughStep[] = [];

  turns.forEach((turn) => {
    const isRep = repFirst
      ? turn.speaker.toLowerCase().includes(repFirst) || turn.speaker.toLowerCase() === "rep"
      : turn.index % 2 === 0;

    const classified = classifyTurn(turn, isRep);
    const matchedMiss = missed.find((m) => {
      const hay = `${m.prospectOpening} ${m.repSurrender}`.toLowerCase();
      return hay.includes(turn.text.slice(0, 40).toLowerCase()) || turn.text.toLowerCase().includes((m.repSurrender || "").slice(0, 32).toLowerCase());
    });

    if (classified) {
      const should = matchedMiss?.whatToSayInstead || classified.shouldHaveDone;
      steps.push({
        step: steps.length + 1,
        timestamp: turn.timestamp,
        timestampSeconds: turn.timestampSeconds,
        speaker: turn.speaker,
        quote: turn.text,
        whatHappened: classified.whatHappened,
        shouldHaveDone: classified.verdict === "good" ? "" : should,
        verdict: classified.verdict,
        category: classified.category,
      });
      return;
    }

    if (matchedMiss && isRep && !isNonSurrender(matchedMiss.repSurrender)) {
      steps.push({
        step: steps.length + 1,
        timestamp: turn.timestamp,
        timestampSeconds: turn.timestampSeconds,
        speaker: turn.speaker,
        quote: turn.text,
        whatHappened: "This is the surrender the coach flagged.",
        shouldHaveDone: matchedMiss.whatToSayInstead,
        verdict: "fatal",
        category: "Missed opportunity",
      });
    }
  });

  // Always include the first and last turns so the coach can walk the whole call.
  const ensure = (turn: TranscriptTurn, category: string, whatHappened: string, verdict: WalkthroughVerdict) => {
    if (steps.some((s) => s.timestampSeconds === turn.timestampSeconds && s.quote === turn.text)) return;
    steps.push({
      step: 0,
      timestamp: turn.timestamp,
      timestampSeconds: turn.timestampSeconds,
      speaker: turn.speaker,
      quote: turn.text,
      whatHappened,
      shouldHaveDone: "",
      verdict,
      category,
    });
  };

  if (turns[0]) ensure(turns[0], "Open", "Call starts here.", "coach");
  const last = turns[turns.length - 1];
  if (last) ensure(last, "Close", "Call ends here.", last.text.toLowerCase().includes("invite") || last.text.toLowerCase().includes("calendar") || last.text.toLowerCase().includes("thursday") ? "good" : "coach");

  return steps
    .sort((a, b) => a.timestampSeconds - b.timestampSeconds || a.step - b.step)
    .map((s, idx) => ({ ...s, step: idx + 1 }));
}

export function buildScorecardFromSandler(input: {
  pain: { status: SandlerStatus; evidence: string };
  budget: { status: SandlerStatus; evidence: string };
  decision: { status: SandlerStatus; evidence: string };
  scriptScore: number;
  missedCount: number;
  coreOutcome: string;
  foldedEarly: boolean;
}): ScorecardMetric[] {
  const statusFromScore = (score: number): SandlerStatus =>
    score >= 8 ? "Pass" : score >= 5 ? "Incomplete" : "Fail";

  const fightScore = input.foldedEarly ? 2 : input.missedCount === 0 ? 8 : Math.max(3, 8 - input.missedCount * 2);
  const booked = input.coreOutcome.toLowerCase().includes("booked");
  const nextScore = booked ? 8 : input.foldedEarly ? 2 : 4;
  const discoveryScore = input.pain.status === "Pass" ? 8 : input.pain.status === "Incomplete" ? 5 : 3;
  const controlScore = Math.round((input.scriptScore + (input.foldedEarly ? 2 : 7)) / 2);
  const authorityScore = input.foldedEarly ? 3 : input.scriptScore >= 8 ? 8 : 5;

  const metrics: Array<[ScorecardKey, SandlerStatus, number, string]> = [
    ["pain", input.pain.status, input.pain.status === "Pass" ? 8 : input.pain.status === "Incomplete" ? 5 : 2, input.pain.evidence],
    ["budget", input.budget.status, input.budget.status === "Pass" ? 8 : input.budget.status === "Incomplete" ? 5 : 2, input.budget.evidence],
    ["decision", input.decision.status, input.decision.status === "Pass" ? 8 : input.decision.status === "Incomplete" ? 5 : 2, input.decision.evidence],
    ["fightForTheWin", statusFromScore(fightScore), fightScore, input.foldedEarly ? "Rep folded on a soft objection instead of fighting for the next minute." : "Held the frame when the prospect pushed back."],
    ["nextStep", statusFromScore(nextScore), nextScore, booked ? "Locked a specific date and time." : "Left with a vague follow-up instead of a calendar commitment."],
    ["discoveryDepth", statusFromScore(discoveryScore), discoveryScore, input.pain.evidence],
    ["controlAndPacing", statusFromScore(controlScore), controlScore, `Script adherence ${input.scriptScore}/10 — ${input.foldedEarly ? "prospect drove the ending." : "rep stayed on the prescribed sequence."}`],
    ["peerAuthority", statusFromScore(authorityScore), authorityScore, input.foldedEarly ? "Tone slipped into vendor / order-taker." : "Held peer-level authority."],
  ];

  return metrics.map(([key, status, score, evidence]) => ({
    key,
    label: SCORECARD_LABELS[key],
    status,
    score,
    evidence,
  }));
}

export function attachCitesToScorecard(
  scorecard: ScorecardMetric[],
  transcriptText: string,
  durationSeconds: number
): ScorecardMetric[] {
  const turns = parseTranscript(transcriptText, durationSeconds);
  return scorecard.map((metric) => {
    if (metric.cite?.quote) return metric;
    const turn = findTurnForQuote(turns, metric.evidence) || findTurnForQuote(turns, metric.cite?.quote || "");
    if (!turn) return metric;
    return {
      ...metric,
      cite: {
        timestamp: turn.timestamp,
        timestampSeconds: turn.timestampSeconds,
        quote: turn.text,
      },
    };
  });
}

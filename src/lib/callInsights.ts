import type {
  Call,
  CallEvaluation,
  MilestoneDivergence,
  SalesScript,
  SandlerStatus,
} from "@/types";
import { isDemoAgreed, isMeetingBooked } from "./coreOutcome";


export interface RankedCall extends Call {
  rank: number;
  score: number;
}

export interface PrimaryIssue {
  text: string;
  severity: "good" | "warn" | "critical";
}

const SANDLER_POINTS: Record<SandlerStatus, number> = {
  Pass: 10,
  Incomplete: 5,
  Fail: 0,
};

function outcomeBonus(outcome: string): number {
  if (isMeetingBooked(outcome)) return 15;
  if (isDemoAgreed(outcome)) return 10;
  const o = outcome.toLowerCase();
  if (o.includes("negotiation") || o.includes("reschedul")) return 8;
  if (o.includes("unqualified")) return 3;
  return 0; // dropped / everything else
}

// Composite 0-100 performance score used to rank calls against each other.
// Weighting: script adherence (0-50) + Sandler qualification (0-30) +
// outcome (0-15), minus a penalty for flagged surrender moments.
export function computeCallScore(call: Call): number {
  const ev = call.evaluation;
  if (!ev) return 0;

  const scriptPoints = ev.sandlerBreakdown.scriptAdherence.score * 5; // 0-50

  const sandlerPoints =
    SANDLER_POINTS[ev.sandlerBreakdown.pain.status] +
    SANDLER_POINTS[ev.sandlerBreakdown.budget.status] +
    SANDLER_POINTS[ev.sandlerBreakdown.decision.status]; // 0-30

  const missedPenalty = Math.min(ev.missedOpportunities.length, 3) * 3; // 0-9

  const extra = ev.scorecard?.filter((m) =>
    m.key === "fightForTheWin" || m.key === "nextStep" || m.key === "discoveryDepth"
  ) || [];
  const extraPoints = extra.length
    ? Math.round(extra.reduce((sum, m) => sum + Math.min(m.score, 10), 0) / extra.length)
    : 0;

  const raw =
    scriptPoints + sandlerPoints + outcomeBonus(call.coreOutcome) + extraPoints - missedPenalty;

  return Math.max(0, Math.min(100, Math.round(raw)));
}

// Ranks calls best-to-worst by composite score. Ties break on the higher
// script-adherence score, then the more recent call.
export function rankCalls(calls: Call[]): RankedCall[] {
  return calls
    .map((call) => ({ ...call, score: computeCallScore(call) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const scoreA = a.evaluation?.sandlerBreakdown.scriptAdherence.score ?? 0;
      const scoreB = b.evaluation?.sandlerBreakdown.scriptAdherence.score ?? 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .map((call, idx) => ({ ...call, rank: idx + 1 }));
}

function joinDimensions(dims: string[]): string {
  if (dims.length <= 1) return dims[0] || "";
  if (dims.length === 2) return `${dims[0]} & ${dims[1]}`;
  return `${dims.slice(0, -1).join(", ")} & ${dims[dims.length - 1]}`;
}

// Concise "what went wrong" pointer for the ranked list. Prioritizes skipped
// qualification, then the manager's top prescribed fix.
export function getPrimaryIssue(call: Call): PrimaryIssue {
  const ev = call.evaluation;
  if (!ev) return { text: "Awaiting evaluation", severity: "warn" };

  const dims: Array<[string, SandlerStatus]> = [
    ["Pain", ev.sandlerBreakdown.pain.status],
    ["Budget", ev.sandlerBreakdown.budget.status],
    ["Decision", ev.sandlerBreakdown.decision.status],
  ];

  const failed = dims.filter(([, s]) => s === "Fail").map(([n]) => n);
  const incomplete = dims.filter(([, s]) => s === "Incomplete").map(([n]) => n);

  if (failed.length === 3) {
    return {
      text: "Skipped entire Sandler qualification (Pain/Budget/Decision)",
      severity: "critical",
    };
  }
  if (failed.length > 0) {
    return {
      text: `Skipped ${joinDimensions(failed)} qualification`,
      severity: "critical",
    };
  }
  if (incomplete.length > 0 && ev.sandlerBreakdown.scriptAdherence.score < 8) {
    return {
      text: ev.topFixes[0]?.title || `Incomplete ${joinDimensions(incomplete)}`,
      severity: "warn",
    };
  }

  return {
    text: ev.topFixes[0]?.title || "Clean execution — polish only",
    severity: "good",
  };
}

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "into", "from", "your", "you",
  "are", "was", "were", "not", "any", "before", "after", "than", "then",
  "within", "first", "prior", "without", "who", "how", "what", "when", "over",
  "each", "must", "should", "have", "has", "had", "our", "their", "them",
  "using", "use", "via", "per", "min", "minute", "minutes", "seconds", "sec",
]);

function keywords(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9$\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 3 && !STOP_WORDS.has(w))
    )
  );
}

// Heuristic per-milestone divergence for calls evaluated by the rule-based
// engine (no LLM). Measures keyword overlap between each prescribed milestone
// and the transcript, calibrated so the number of "Hit" milestones tracks the
// manager's overall adherence score. The LLM path returns richer divergence
// directly; seeded calls carry hand-authored divergence.
export function computeScriptDivergence(
  transcript: string,
  script: SalesScript | null,
  adherenceScore: number
): CallEvaluation["scriptDivergence"] {
  if (!script || script.keyMilestones.length === 0) return undefined;

  const transcriptTokens = new Set(keywords(transcript));

  const scored = script.keyMilestones.map((milestone) => {
    const kw = keywords(milestone);
    const matches = kw.filter((w) => transcriptTokens.has(w));
    const ratio = kw.length ? matches.length / kw.length : 0;
    return { milestone, ratio, matches };
  });

  const total = scored.length;
  const hitTarget = Math.round((adherenceScore / 10) * total);

  const ordered = [...scored].sort((a, b) => b.ratio - a.ratio);
  const hitSet = new Set(ordered.slice(0, hitTarget).map((s) => s.milestone));

  const milestones: MilestoneDivergence[] = scored.map((s) => {
    let status: MilestoneDivergence["status"];
    if (hitSet.has(s.milestone) && s.ratio > 0) {
      status = "Hit";
    } else if (s.ratio >= 0.25) {
      status = "Partial";
    } else {
      status = "Missed";
    }

    const note =
      status === "Hit"
        ? "Milestone language detected in the transcript."
        : status === "Partial"
        ? "Partially referenced but not fully executed."
        : "No evidence of this milestone in the transcript.";

    return { milestone: s.milestone, status, note };
  });

  return { scriptId: script.id, scriptTitle: script.title, milestones };
}

// Summary counts for a divergence breakdown (used by the UI badges).
export function divergenceSummary(
  divergence: CallEvaluation["scriptDivergence"]
): { hit: number; partial: number; missed: number; total: number } {
  const milestones = divergence?.milestones ?? [];
  return {
    hit: milestones.filter((m) => m.status === "Hit").length,
    partial: milestones.filter((m) => m.status === "Partial").length,
    missed: milestones.filter((m) => m.status === "Missed").length,
    total: milestones.length,
  };
}

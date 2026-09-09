import type { CallEvaluation, MissedOpportunity, PriorityFix, SandlerStatus } from "@/types";
import { parseExtendedReview, stampMissedOpportunities } from "@/lib/ai/review";

export interface EvaluationRow {
  id: string;
  callId: string;
  repId: string;
  bottomLine: string;
  painStatus: string;
  painEvidence: string;
  budgetStatus: string;
  budgetEvidence: string;
  decisionStatus: string;
  decisionEvidence: string;
  scriptAdherenceScore: number;
  scriptFeedback: string;
  scriptDivergence?: string | null;
  missedOpportunities?: string | null;
  topFixes?: string | null;
  rawMarkdown?: string | null;
  extendedReview?: string | null;
  createdAt: string;
}

export function hydrateEvaluation(
  ev: EvaluationRow,
  extras: {
    repName: string;
    callStage: string;
    coreOutcome: string;
    transcriptText?: string;
    durationSeconds?: number;
  }
): CallEvaluation {
  const extended = parseExtendedReview(ev.extendedReview);
  let missed: MissedOpportunity[] = [];
  try {
    missed = JSON.parse(ev.missedOpportunities || "[]");
  } catch {
    missed = [];
  }
  if (extras.transcriptText) {
    missed = stampMissedOpportunities(missed, extras.transcriptText, extras.durationSeconds || 0);
  }

  let topFixes: [PriorityFix, PriorityFix] | PriorityFix[] = [];
  try {
    topFixes = JSON.parse(ev.topFixes || "[]");
  } catch {
    topFixes = [];
  }

  return {
    id: ev.id,
    callId: ev.callId,
    repId: ev.repId,
    repName: extras.repName,
    callTypeDetected: extras.callStage,
    coreOutcome: extras.coreOutcome,
    bottomLine: ev.bottomLine,
    missedOpportunities: missed,
    sandlerBreakdown: {
      pain: { status: ev.painStatus as SandlerStatus, evidence: ev.painEvidence },
      budget: { status: ev.budgetStatus as SandlerStatus, evidence: ev.budgetEvidence },
      decision: { status: ev.decisionStatus as SandlerStatus, evidence: ev.decisionEvidence },
      scriptAdherence: { score: ev.scriptAdherenceScore, feedback: ev.scriptFeedback },
    },
    scriptDivergence: ev.scriptDivergence ? JSON.parse(ev.scriptDivergence) : undefined,
    topFixes: topFixes as [PriorityFix, PriorityFix],
    scorecard: extended?.scorecard,
    walkthrough: extended?.walkthrough,
    evaluatedWith: extended?.evaluatedWith,
    rawMarkdown: ev.rawMarkdown || undefined,
    createdAt: ev.createdAt,
  };
}

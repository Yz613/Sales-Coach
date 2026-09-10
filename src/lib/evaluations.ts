import type { CallEvaluation, MissedOpportunity, PriorityFix, SandlerStatus, ScriptDivergence } from "@/types";
import { parseExtendedReview, stampMissedOpportunities } from "@/lib/ai/review";

export function latestEvaluationsByCall<T extends { callId: string; createdAt: string }>(
  rows: T[]
): T[] {
  const latest = new Map<string, T>();
  for (const row of rows) {
    const existing = latest.get(row.callId);
    if (!existing || row.createdAt > existing.createdAt) {
      latest.set(row.callId, row);
    }
  }
  return [...latest.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

export function latestEvaluationRow(
  rows: EvaluationRow[],
  callId: string
): EvaluationRow | undefined {
  return latestEvaluationsByCall(rows.filter((row) => row.callId === callId))[0];
}

export function usedLlmReview(
  ev?: { evaluatedWith?: { provider?: string; fallback?: string } | null } | null
): boolean {
  return Boolean(ev?.evaluatedWith?.provider) && ev?.evaluatedWith?.fallback !== "rules";
}

export function ruleEngineNotice(
  ev?: {
    evaluatedWith?: { provider?: string; model?: string; fallback?: string; error?: string } | null;
  } | null,
  opts: { hasKey?: boolean; providerName?: string } = {}
): string | null {
  if (usedLlmReview(ev)) return null;
  if (ev?.evaluatedWith?.error) {
    const who = opts.providerName || ev.evaluatedWith.provider || "AI provider";
    const model = ev.evaluatedWith.model ? ` · ${ev.evaluatedWith.model}` : "";
    return `AI scoring failed (${who}${model}): ${ev.evaluatedWith.error} This score used the built-in rule engine.`;
  }
  if (opts.hasKey) {
    return "This score was generated with the built-in rule engine before your API key was applied. Use Reanalyze with AI to score it with the connected key.";
  }
  return "This score used the built-in rule engine. Add an API key in Settings, then reanalyze.";
}

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

function parseJsonArray<T>(raw: string | null | undefined, fallback: T[]): T[] {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function parseJsonObject<T>(raw: string | null | undefined): T | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as T) : undefined;
  } catch {
    return undefined;
  }
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
  let missed = parseJsonArray<MissedOpportunity>(ev.missedOpportunities, []);
  if (extras.transcriptText) {
    missed = stampMissedOpportunities(missed, extras.transcriptText, extras.durationSeconds || 0);
  }

  const topFixes = parseJsonArray<PriorityFix>(ev.topFixes, []);

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
    scriptDivergence: parseJsonObject<ScriptDivergence>(ev.scriptDivergence),
    topFixes: topFixes as [PriorityFix, PriorityFix],
    scorecard: extended?.scorecard,
    walkthrough: extended?.walkthrough,
    evaluatedWith: extended?.evaluatedWith,
    rawMarkdown: ev.rawMarkdown || undefined,
    createdAt: ev.createdAt,
  };
}

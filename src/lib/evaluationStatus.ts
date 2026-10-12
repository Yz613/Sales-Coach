import { isUnusableTranscript } from "./transcript";

/** A call left in analyzing longer than this has no live evaluation. */
export const ANALYSIS_STALE_MS = 30 * 60 * 1000;

export type CallEvaluationStatus = "completed" | "analyzing" | "failed" | "not_applicable";

export type EvaluationDisplay = "score" | "analyzing" | "failed" | "not_applicable";

/** One-tap dial logs have no recording and no dialogue, so coaching never starts. */
export function isDialLog(input: { audioUrl?: string | null; transcriptText?: string | null }): boolean {
  return !input.audioUrl && isUnusableTranscript(input.transcriptText);
}

/** Dial logs are terminal at creation. They must never enter analyzing. */
export function resolveNewCallStatus(input: {
  status?: string | null;
  audioUrl?: string | null;
  transcriptText?: string | null;
}): CallEvaluationStatus {
  if (isDialLog(input)) return "not_applicable";
  if (input.status === "failed" || input.status === "not_applicable" || input.status === "analyzing") return input.status;
  return "completed";
}

export function outcomeForStatus(status: CallEvaluationStatus, coreOutcome: string): string {
  if (status === "not_applicable" && /^analyzing\b/i.test(coreOutcome.trim())) return "—";
  if (status === "failed" && /^analyzing\b/i.test(coreOutcome.trim())) return "Evaluation failed";
  return coreOutcome;
}

/** What the call list should render when there is no saved evaluation. */
export function evaluationDisplay(input: {
  status?: string | null;
  createdAt?: string | null;
  hasLiveJob?: boolean;
}, now = Date.now()): EvaluationDisplay {
  if (input.status === "not_applicable") return "not_applicable";
  if (input.status === "failed") return "failed";
  if (input.status === "analyzing") {
    const created = Date.parse(input.createdAt || "");
    const fresh = Number.isFinite(created) && now - created < ANALYSIS_STALE_MS;
    if (fresh || input.hasLiveJob) return "analyzing";
    return "failed";
  }
  return "not_applicable";
}

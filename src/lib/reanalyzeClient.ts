import { apiPath } from "@/lib/utils";

export interface ReanalyzeResult {
  success: boolean;
  usedLlm: boolean;
  warning?: string;
  callId: string;
}

export async function postReanalyze(callId: string): Promise<ReanalyzeResult> {
  const res = await fetch(apiPath(`/api/calls/${encodeURIComponent(callId)}/evaluate`), {
    method: "POST",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Failed to reanalyze call");
  }
  return {
    success: true,
    usedLlm: Boolean(data.usedLlm ?? data.evaluation?.evaluatedWith),
    warning: typeof data.warning === "string" ? data.warning : undefined,
    callId,
  };
}

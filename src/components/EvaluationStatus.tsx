"use client";

import ReanalyzeButton from "@/components/ReanalyzeButton";
import { evaluationDisplay } from "@/lib/evaluationStatus";

export default function EvaluationStatus({
  callId,
  status,
  createdAt,
  hasLiveJob = false,
  hasApiKey,
}: {
  callId: string;
  status?: string | null;
  createdAt?: string | null;
  hasLiveJob?: boolean;
  hasApiKey?: boolean;
}) {
  const display = evaluationDisplay({ status, createdAt, hasLiveJob });
  if (display === "analyzing") {
    return <span className="text-xs text-[#86868b] font-mono">Analyzing...</span>;
  }
  if (display === "failed") {
    return (
      <span className="inline-flex flex-col items-start gap-1">
        <span className="text-xs font-medium text-[#FF3B30]">Failed</span>
        <ReanalyzeButton callId={callId} variant="compact" hasApiKey={hasApiKey} />
      </span>
    );
  }
  return <span className="text-xs text-[#86868b] font-mono">—</span>;
}

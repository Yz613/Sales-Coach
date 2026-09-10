"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { postReanalyze } from "@/lib/reanalyzeClient";

interface ReanalyzeButtonProps {
  callId: string;
  variant?: "full" | "compact";
  hasApiKey?: boolean;
  usedLlm?: boolean;
  onComplete?: () => void;
}

export default function ReanalyzeButton({
  callId,
  variant = "full",
  hasApiKey,
  usedLlm,
  onComplete,
}: ReanalyzeButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const run = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    setWarning(null);
    try {
      const result = await postReanalyze(callId);
      if (result.warning) setWarning(result.warning);
      onComplete?.();
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to reanalyze call");
    } finally {
      setLoading(false);
    }
  };

  if (variant === "compact") {
    return (
      <span className="inline-flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={run}
          disabled={loading}
          title={hasApiKey ? "Reanalyze this call with the current AI key" : "Reanalyze this call"}
          className="rounded bg-slate-800 border border-slate-700 px-2 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition inline-flex items-center gap-1 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          {loading ? "Scoring…" : "Reanalyze"}
        </button>
        {error && <span className="text-[10px] text-rose-400 max-w-[9rem] text-right">{error}</span>}
        {warning && !error && <span className="text-[10px] text-amber-300 max-w-[12rem] text-right">{warning}</span>}
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={run}
        disabled={loading}
        className="rounded-lg bg-slate-800 border border-slate-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 transition inline-flex items-center gap-1.5 disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        {loading ? "Reanalyzing…" : usedLlm ? "Reanalyze call" : "Reanalyze with AI"}
      </button>
      {error && <span className="text-[11px] text-rose-400">{error}</span>}
      {warning && !error && <span className="text-[11px] text-amber-300 max-w-sm text-right">{warning}</span>}
    </div>
  );
}

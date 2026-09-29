"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { postReanalyze } from "@/lib/reanalyzeClient";

export interface ReanalyzeTarget {
  id: string;
  usedLlm: boolean;
}

interface ReanalyzeCallsBarProps {
  calls: ReanalyzeTarget[];
  hasApiKey: boolean;
  providerName: string;
}

export default function ReanalyzeCallsBar({
  calls,
  hasApiKey,
  providerName,
}: ReanalyzeCallsBarProps) {
  const router = useRouter();
  const cancelRef = useRef(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [doneCount, setDoneCount] = useState<number | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [warning, setWarning] = useState<string | null>(null);

  const withoutAi = calls.filter((c) => !c.usedLlm);
  const needsAiPass = hasApiKey && withoutAi.length > 0;

  const run = async (targets: ReanalyzeTarget[]) => {
    if (!targets.length || running) return;
    cancelRef.current = false;
    setRunning(true);
    setDoneCount(null);
    setErrors([]);
    setWarning(null);
    setProgress({ current: 0, total: targets.length });

    let completed = 0;
    const failed: string[] = [];
    let lastWarning: string | undefined;

    for (let i = 0; i < targets.length; i++) {
      if (cancelRef.current) break;
      setProgress({ current: i + 1, total: targets.length });
      try {
        const result = await postReanalyze(targets[i].id);
        completed += 1;
        if (result.warning) lastWarning = result.warning;
      } catch (err: any) {
        failed.push(`${targets[i].id}: ${err.message || "failed"}`);
      }
    }

    setProgress(null);
    setRunning(false);
    setDoneCount(completed);
    setErrors(failed);
    if (lastWarning) setWarning(lastWarning);
    router.refresh();
  };

  if (!calls.length) return null;

  return (
    <div className="rounded-2xl glass-card p-5 space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#007AFF]">
            <RefreshCw className="h-3.5 w-3.5" /> Reanalyze calls
          </div>
          <p className="text-sm text-[#3a3a3c] mt-1">
            {hasApiKey
              ? needsAiPass
                ? `${withoutAi.length} call${withoutAi.length === 1 ? " was" : "s were"} scored without ${providerName}. Re-run them with your API key.`
                : `Re-score any call with the current ${providerName} key, model, and coaching directives.`
              : "Add an API key in Settings, then reanalyze uploaded calls for a full AI review."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {running && (
            <button
              type="button"
              onClick={() => {
                cancelRef.current = true;
              }}
              className="rounded-xl border border-black/[0.1] bg-black/[0.04] hover:bg-black/[0.08] px-3.5 py-2 text-xs font-semibold text-[#1d1d1f] transition"
            >
              Stop
            </button>
          )}
          {needsAiPass && (
            <button
              type="button"
              onClick={() => run(withoutAi)}
              disabled={running}
              className="flex items-center gap-1.5 rounded-xl bg-[#007AFF] hover:bg-[#0071E3] border border-black/10 px-4 py-2 text-xs font-semibold text-white shadow-md transition disabled:opacity-50"
            >
              {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Reanalyze {withoutAi.length} without AI
            </button>
          )}
          <button
            type="button"
            onClick={() => run(calls)}
            disabled={running}
            className="flex items-center gap-1.5 rounded-xl border border-black/[0.1] bg-black/[0.04] hover:bg-black/[0.08] px-4 py-2 text-xs font-semibold text-[#1d1d1f] transition disabled:opacity-50"
          >
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Reanalyze all {calls.length}
          </button>
        </div>
      </div>

      {running && progress && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[#6e6e73]">
            <span>Scoring call {progress.current} of {progress.total}…</span>
            <span className="font-mono">{Math.round((progress.current / progress.total) * 100)}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-[#F2F2F7] overflow-hidden border border-black/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 transition-all"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {doneCount !== null && !running && (
        <div className="flex items-start gap-2 text-xs font-medium text-[#248A3D]">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            Reanalyzed {doneCount} call{doneCount === 1 ? "" : "s"}
            {errors.length ? ` · ${errors.length} failed` : ""}.
          </span>
        </div>
      )}

      {warning && !running && (
        <p className="text-xs text-[#C45500] font-medium">{warning}</p>
      )}

      {errors.length > 0 && !running && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/25 bg-rose-500/10 p-2.5 text-xs text-[#D70015]">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-[#FF3B30]" />
          <span>{errors.slice(0, 3).join(" · ")}{errors.length > 3 ? ` · +${errors.length - 3} more` : ""}</span>
        </div>
      )}
    </div>
  );
}

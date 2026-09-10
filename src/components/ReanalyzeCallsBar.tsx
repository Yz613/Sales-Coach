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
    <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 space-y-3">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-400">
            <RefreshCw className="h-3.5 w-3.5" /> Reanalyze calls
          </div>
          <p className="text-sm text-slate-300 mt-1">
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
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
            >
              Stop
            </button>
          )}
          {needsAiPass && (
            <button
              type="button"
              onClick={() => run(withoutAi)}
              disabled={running}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition disabled:opacity-50"
            >
              {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Reanalyze {withoutAi.length} without AI
            </button>
          )}
          <button
            type="button"
            onClick={() => run(calls)}
            disabled={running}
            className="flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-700 transition disabled:opacity-50"
          >
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Reanalyze all {calls.length}
          </button>
        </div>
      </div>

      {running && progress && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Scoring call {progress.current} of {progress.total}…</span>
            <span className="font-mono">{Math.round((progress.current / progress.total) * 100)}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500 transition-all"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {doneCount !== null && !running && (
        <div className="flex items-start gap-2 text-xs text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            Reanalyzed {doneCount} call{doneCount === 1 ? "" : "s"}
            {errors.length ? ` · ${errors.length} failed` : ""}.
          </span>
        </div>
      )}

      {warning && !running && (
        <p className="text-xs text-amber-300">{warning}</p>
      )}

      {errors.length > 0 && !running && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{errors.slice(0, 3).join(" · ")}{errors.length > 3 ? ` · +${errors.length - 3} more` : ""}</span>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, type ReactNode } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

export interface QuickRow {
  id: string;
  label: string;
  done: boolean;
  evidence: string;
}

export default function CallReviewSwitcher({
  methodName,
  pillars,
  highlights,
  children,
}: {
  methodName: string;
  pillars: QuickRow[];
  highlights: QuickRow[];
  children: ReactNode;
}) {
  const [mode, setMode] = useState<"quick" | "full">("quick");
  const rows = [...pillars, ...highlights.filter((row) => !pillars.some((pillar) => pillar.label === row.label))];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMode("quick")}
          className={`rounded-full px-3.5 py-1.5 text-xs font-semibold border transition ${
            mode === "quick"
              ? "bg-white text-slate-900 border-white"
              : "bg-white/[0.04] text-slate-300 border-white/[0.08] hover:bg-white/[0.08]"
          }`}
        >
          Quick look
        </button>
        <button
          type="button"
          onClick={() => setMode("full")}
          className={`rounded-full px-3.5 py-1.5 text-xs font-semibold border transition ${
            mode === "full"
              ? "bg-white text-slate-900 border-white"
              : "bg-white/[0.04] text-slate-300 border-white/[0.08] hover:bg-white/[0.08]"
          }`}
        >
          Full review
        </button>
      </div>

      {mode === "quick" ? (
        <div className="rounded-2xl glass-card p-6 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">{methodName}</h2>
            <p className="text-xs text-slate-400 mt-1">The checks that matter on this call. Open the full review for the rest.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {rows.map((row) => (
              <div
                key={row.id}
                className={`rounded-xl border px-3.5 py-3 ${
                  row.done ? "border-emerald-500/25 bg-emerald-500/[0.06]" : "border-rose-500/25 bg-rose-500/[0.06]"
                }`}
              >
                <div className="flex items-center gap-2">
                  {row.done ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <XCircle className="h-4 w-4 text-rose-400" />}
                  <span className="text-sm font-semibold text-white">{row.label}</span>
                  <span className={`ml-auto text-[10px] font-bold uppercase tracking-wider ${row.done ? "text-emerald-300" : "text-rose-300"}`}>
                    {row.done ? "Done" : "Not done"}
                  </span>
                </div>
                {row.evidence ? <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{row.evidence}</p> : null}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setMode("full")}
            className="text-xs font-semibold text-blue-400 hover:text-blue-300"
          >
            Open the full review
          </button>
        </div>
      ) : (
        <div className="space-y-8">{children}</div>
      )}
    </div>
  );
}

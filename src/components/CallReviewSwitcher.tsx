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
      <div className="inline-flex rounded-full bg-[#E5E5EA] p-0.5">
        <button
          type="button"
          onClick={() => setMode("quick")}
          className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition ${
            mode === "quick" ? "bg-white text-[#1d1d1f] shadow-sm" : "text-[#3a3a3c]"
          }`}
        >
          Quick look
        </button>
        <button
          type="button"
          onClick={() => setMode("full")}
          className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition ${
            mode === "full" ? "bg-white text-[#1d1d1f] shadow-sm" : "text-[#3a3a3c]"
          }`}
        >
          Full review
        </button>
      </div>

      {mode === "quick" ? (
        <div className="rounded-2xl glass-card p-6 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-[#1d1d1f] tracking-tight">{methodName}</h2>
            <p className="text-xs text-[#6e6e73] mt-1">The checks that matter on this call. Open the full review for the rest.</p>
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
                  {row.done ? <CheckCircle2 className="h-4 w-4 text-[#248A3D]" /> : <XCircle className="h-4 w-4 text-[#FF3B30]" />}
                  <span className="text-sm font-semibold text-[#1d1d1f]">{row.label}</span>
                  <span className={`ml-auto text-[10px] font-bold uppercase tracking-wider ${row.done ? "text-[#248A3D]" : "text-[#D70015]"}`}>
                    {row.done ? "Done" : "Not done"}
                  </span>
                </div>
                {row.evidence ? <p className="text-xs text-[#6e6e73] mt-1.5 leading-relaxed">{row.evidence}</p> : null}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setMode("full")}
            className="text-xs font-semibold text-[#007AFF] hover:text-[#0071E3] transition"
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

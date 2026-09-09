"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, GraduationCap, Clock } from "lucide-react";
import type { CoachWalkthroughStep, WalkthroughVerdict } from "@/lib/ai/review";

const VERDICT_META: Record<WalkthroughVerdict, { label: string; badge: string; border: string; bg: string; icon: typeof CheckCircle2 }> = {
  good: { label: "Did this right", badge: "bg-emerald-500/20 text-emerald-300", border: "border-emerald-500/30", bg: "bg-emerald-500/5", icon: CheckCircle2 },
  coach: { label: "Coaching moment", badge: "bg-blue-500/20 text-blue-300", border: "border-blue-500/30", bg: "bg-blue-500/5", icon: GraduationCap },
  miss: { label: "Should have done this", badge: "bg-amber-500/20 text-amber-300", border: "border-amber-500/30", bg: "bg-amber-500/5", icon: AlertTriangle },
  fatal: { label: "Fold / fatal miss", badge: "bg-rose-500/20 text-rose-300", border: "border-rose-500/30", bg: "bg-rose-500/5", icon: XCircle },
};

type Filter = "all" | "needs-work" | "wins";

export default function CoachWalkthrough({ steps }: { steps: CoachWalkthroughStep[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [active, setActive] = useState(1);

  const filtered = useMemo(() => {
    if (filter === "needs-work") return steps.filter((s) => s.verdict === "miss" || s.verdict === "fatal");
    if (filter === "wins") return steps.filter((s) => s.verdict === "good");
    return steps;
  }, [filter, steps]);

  if (!steps.length) return null;

  const selected = filtered.find((s) => s.step === active) || filtered[0];

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/90 overflow-hidden">
      <div className="border-b border-slate-800 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
            <GraduationCap className="h-4 w-4" /> Coach walkthrough — pick it apart
          </div>
          <h2 className="text-lg font-bold text-white mt-1">What they should have done, moment by moment</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Pause the tape at each step. Every miss cites the clock time and the exact line.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-950 p-1 text-[11px] font-semibold">
          {([
            ["all", `All ${steps.length}`],
            ["needs-work", "Should-haves"],
            ["wins", "Wins"],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setFilter(id);
                setActive(-1);
              }}
              className={`rounded-md px-2.5 py-1 ${
                filter === id ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr]">
        <ol className="border-b lg:border-b-0 lg:border-r border-slate-800 bg-slate-950/60 max-h-[28rem] overflow-y-auto">
          {filtered.map((step) => {
            const meta = VERDICT_META[step.verdict] || VERDICT_META.coach;
            const isOn = (selected?.step || 0) === step.step;
            return (
              <li key={step.step}>
                <button
                  type="button"
                  onClick={() => setActive(step.step)}
                  className={`w-full text-left px-4 py-3 border-l-2 transition ${
                    isOn ? `${meta.border} bg-slate-900` : "border-transparent hover:bg-slate-900/70"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-slate-400">Step {step.step}</span>
                    <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-300">
                      <Clock className="h-3 w-3" /> {step.timestamp || "—"}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-white mt-1 truncate">{step.category}</p>
                  <p className={`mt-1 text-[10px] uppercase tracking-wider font-bold ${meta.badge} inline-block rounded px-1.5 py-0.5`}>
                    {meta.label}
                  </p>
                </button>
              </li>
            );
          })}
        </ol>

        {selected && (
          <div className="p-6 space-y-4">
            {(() => {
              const meta = VERDICT_META[selected.verdict] || VERDICT_META.coach;
              const Icon = meta.icon;
              return (
                <div className={`rounded-lg border ${meta.border} ${meta.bg} p-4 space-y-3`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-bold uppercase ${meta.badge}`}>
                      <Icon className="h-3.5 w-3.5" /> {meta.label}
                    </span>
                    <a
                      href={`#t-${selected.timestampSeconds}`}
                      className="inline-flex items-center gap-1 rounded bg-slate-950 px-2 py-0.5 font-mono text-xs text-blue-300 border border-slate-700 hover:border-blue-500"
                    >
                      <Clock className="h-3 w-3" /> {selected.timestamp || "—"} on the call
                    </a>
                    <span className="text-xs text-slate-400">{selected.speaker} · {selected.category}</span>
                  </div>
                  <blockquote className="text-sm text-white italic leading-relaxed border-l-2 border-slate-600 pl-3">
                    “{selected.quote}”
                  </blockquote>
                  <p className="text-sm text-slate-200 leading-relaxed">{selected.whatHappened}</p>
                  {selected.shouldHaveDone ? (
                    <div className="rounded-md border border-emerald-500/25 bg-emerald-500/10 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-1">
                        Should have done this here
                      </p>
                      <p className="text-sm text-emerald-100 leading-relaxed">“{selected.shouldHaveDone}”</p>
                    </div>
                  ) : (
                    <p className="text-xs text-emerald-300">Keep this. No rewrite needed at {selected.timestamp}.</p>
                  )}
                </div>
              );
            })()}

            <div className="flex justify-between text-xs">
              <button
                type="button"
                disabled={!filtered.length || filtered[0].step === selected.step}
                onClick={() => {
                  const idx = filtered.findIndex((s) => s.step === selected.step);
                  if (idx > 0) setActive(filtered[idx - 1].step);
                }}
                className="rounded border border-slate-700 px-3 py-1.5 text-slate-300 hover:bg-slate-800 disabled:opacity-40"
              >
                Previous moment
              </button>
              <button
                type="button"
                disabled={!filtered.length || filtered[filtered.length - 1].step === selected.step}
                onClick={() => {
                  const idx = filtered.findIndex((s) => s.step === selected.step);
                  if (idx >= 0 && idx < filtered.length - 1) setActive(filtered[idx + 1].step);
                }}
                className="rounded border border-slate-700 px-3 py-1.5 text-slate-300 hover:bg-slate-800 disabled:opacity-40"
              >
                Next moment
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

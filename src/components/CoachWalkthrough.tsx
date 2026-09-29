"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, GraduationCap, Clock } from "lucide-react";
import type { CoachWalkthroughStep, WalkthroughVerdict } from "@/lib/ai/review";

const VERDICT_META: Record<WalkthroughVerdict, { label: string; badge: string; border: string; bg: string; icon: typeof CheckCircle2 }> = {
  good: { label: "Did this right", badge: "bg-emerald-500/10 text-[#248A3D] border border-emerald-500/20", border: "border-emerald-500/30", bg: "bg-emerald-500/5", icon: CheckCircle2 },
  coach: { label: "Coaching moment", badge: "bg-blue-500/10 text-[#007AFF] border border-blue-500/20", border: "border-blue-500/30", bg: "bg-blue-500/5", icon: GraduationCap },
  miss: { label: "Should have done this", badge: "bg-amber-500/10 text-[#C45500] border border-amber-500/20", border: "border-amber-500/30", bg: "bg-amber-500/5", icon: AlertTriangle },
  fatal: { label: "Fold / fatal miss", badge: "bg-rose-500/10 text-[#FF3B30] border border-rose-500/20", border: "border-rose-500/30", bg: "bg-rose-500/5", icon: XCircle },
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
    <div className="rounded-2xl glass-card overflow-hidden">
      <div className="border-b border-black/[0.08] px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-black/[0.02]">
        <div>
          <div className="flex items-center gap-2 text-[#C45500] font-bold text-xs uppercase tracking-wider">
            <GraduationCap className="h-4 w-4" /> Coach walkthrough — pick it apart
          </div>
          <h2 className="text-lg font-bold text-[#1d1d1f] mt-1 tracking-tight">What they should have done, moment by moment</h2>
          <p className="text-xs text-[#6e6e73] mt-0.5">
            Pause the tape at each step. Every miss cites the clock time and the exact line.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-black/[0.08] bg-[#F2F2F7] p-1 text-[11px] font-semibold">
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
              className={`rounded-full px-3 py-1 transition ${
 filter === id ? "bg-black/[0.08] text-[#1d1d1f] shadow-xs" : "text-[#6e6e73] hover:text-[#1d1d1f]"
 }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr]">
        <ol className="border-b lg:border-b-0 lg:border-r border-black/[0.08] bg-[#F5F5F7] max-h-[28rem] overflow-y-auto p-1.5 space-y-1">
          {filtered.map((step) => {
            const meta = VERDICT_META[step.verdict] || VERDICT_META.coach;
            const isOn = (selected?.step || 0) === step.step;
            return (
              <li key={step.step}>
                <button
                  type="button"
                  onClick={() => setActive(step.step)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl border transition ${
                    isOn ? `${meta.border} bg-black/[0.06] shadow-xs`: "border-transparent hover:bg-black/[0.03]"
 }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-[#6e6e73]">Step {step.step}</span>
                    <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[#3a3a3c]">
                      <Clock className="h-3 w-3" /> {step.timestamp || "—"}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-[#1d1d1f] mt-1 truncate">{step.category}</p>
                  <p className={`mt-1 text-[10px] uppercase tracking-wider font-bold ${meta.badge} inline-block rounded-full px-2 py-0.5`}>
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
                <div className={`rounded-2xl border ${meta.border} ${meta.bg} p-5 space-y-3.5`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-[11px] font-semibold uppercase ${meta.badge}`}>
                      <Icon className="h-3.5 w-3.5" /> {meta.label}
                    </span>
                    <a
                      href={`#t-${selected.timestampSeconds}`}
                      className="inline-flex items-center gap-1 rounded-full bg-[#F2F2F7] px-2.5 py-0.5 font-mono text-xs text-[#007AFF] border border-black/[0.08] hover:border-blue-500 transition"
                    >
                      <Clock className="h-3 w-3" /> {selected.timestamp || "—"} on the call
                    </a>
                    <span className="text-xs text-[#6e6e73]">{selected.speaker} · {selected.category}</span>
                  </div>
                  <blockquote className="text-sm text-[#1d1d1f] italic leading-relaxed border-l-2 border-black/[0.12] pl-3.5 py-0.5">
                    “{selected.quote}”
                  </blockquote>
                  <p className="text-sm text-[#1d1d1f] leading-relaxed">{selected.whatHappened}</p>
                  {selected.shouldHaveDone ? (
                    <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#248A3D] mb-1">
                        Should have done this here
                      </p>
                      <p className="text-sm text-[#1d1d1f] font-medium leading-relaxed">“{selected.shouldHaveDone}”</p>
                    </div>
                  ) : (
                    <p className="text-xs text-[#248A3D] font-medium">Keep this. No rewrite needed at {selected.timestamp}.</p>
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
                className="rounded-xl border border-black/[0.1] bg-black/[0.04] hover:bg-black/[0.08] px-4 py-2 text-[#3a3a3c] hover:text-[#1d1d1f] transition disabled:opacity-40"
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
                className="rounded-xl border border-black/[0.1] bg-black/[0.04] hover:bg-black/[0.08] px-4 py-2 text-[#3a3a3c] hover:text-[#1d1d1f] transition disabled:opacity-40"
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

import Link from "next/link";
import { getAllReps } from "@/lib/db/service";
import { CheckCircle2, Clock, XCircle, ArrowUpRight, TrendingUp, ShieldCheck } from "lucide-react";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function RepsPage() {
  await requireAdmin();
  const reps = await getAllReps();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="rounded-full bg-blue-500/10 px-3 py-0.5 text-xs font-semibold uppercase tracking-wider text-blue-400 border border-blue-500/20">
              Sales Team
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Sales Rep Scorecards & Progression
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Scorecards, progression, and a ready 1:1 talk track — four misses and four wins with examples from each rep&apos;s calls.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {reps.map((rep) => {
          const isProgressing = rep.trajectory === "progressing";
          const isStagnant = rep.trajectory === "stagnant";
          const isRegressing = rep.trajectory === "regressing";

          return (
            <div
              key={rep.id}
              className="rounded-2xl glass-card glass-card-hover p-6 sm:p-7 space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">{rep.name}</h2>
                  <p className="text-xs text-slate-400 mt-0.5">{rep.role} • {rep.email}</p>
                </div>

                {isProgressing && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/25">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-xs shadow-emerald-400" /> Progressing
                  </span>
                )}

                {isStagnant && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400 border border-amber-500/25">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-xs shadow-amber-400" /> Stagnant
                  </span>
                )}

                {isRegressing && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-400 border border-rose-500/25">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-400 shadow-xs shadow-rose-400" /> Regressing
                  </span>
                )}
              </div>

              {/* Manager's Assessment */}
              <div className="rounded-xl glass-inset p-4 text-xs text-slate-300 leading-relaxed font-normal border border-white/[0.06]">
                <span className="text-blue-400 font-bold block mb-1.5 uppercase tracking-wider text-[10px]">
                  Manager's Current Assessment:
                </span>
                "{rep.trajectoryReason}"
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-4 gap-2.5 pt-1 text-center font-mono">
                <div className="rounded-xl glass-inset p-2.5 border border-white/[0.06]">
                  <span className="text-[10px] uppercase font-semibold text-slate-500 block">Calls</span>
                  <span className="text-base font-bold text-white">{rep.totalCalls}</span>
                </div>
                <div className="rounded-xl glass-inset p-2.5 border border-white/[0.06]">
                  <span className="text-[10px] uppercase font-semibold text-slate-500 block">Pain</span>
                  <span className="text-base font-bold text-blue-400">{rep.painPassRate}%</span>
                </div>
                <div className="rounded-xl glass-inset p-2.5 border border-white/[0.06]">
                  <span className="text-[10px] uppercase font-semibold text-slate-500 block">Budget</span>
                  <span className="text-base font-bold text-emerald-400">{rep.budgetPassRate}%</span>
                </div>
                <div className="rounded-xl glass-inset p-2.5 border border-white/[0.06]">
                  <span className="text-[10px] uppercase font-semibold text-slate-500 block">Script</span>
                  <span className="text-base font-bold text-amber-400">{rep.avgScriptScore}</span>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Link
                  href={`/reps/${rep.id}#talk-track`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.1] bg-white/[0.06] hover:bg-white/[0.12] px-4 py-2 text-xs font-semibold text-white transition backdrop-blur-md"
                >
                  Open 1:1 talk track & call history <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

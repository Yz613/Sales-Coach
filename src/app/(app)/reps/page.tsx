import Link from "next/link";
import { getAllReps } from "@/lib/db/service";
import { CheckCircle2, Clock, XCircle, ArrowUpRight, TrendingUp, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function RepsPage() {
  const reps = await getAllReps();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="rounded bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-blue-400 border border-blue-500/20">
              Sales Team
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Sales Rep Scorecards & Progression
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Detailed performance tracking, objection-handling discipline, and progression status.
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
              className="rounded-xl border border-slate-800 bg-slate-900/90 p-6 space-y-4 hover:border-slate-700 transition"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">{rep.name}</h2>
                  <p className="text-xs text-slate-400">{rep.role} • {rep.email}</p>
                </div>

                {isProgressing && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="h-3 w-3" /> Progressing
                  </span>
                )}

                {isStagnant && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-400 border border-amber-500/20">
                    <Clock className="h-3 w-3" /> Stagnant
                  </span>
                )}

                {isRegressing && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-400 border border-rose-500/20">
                    <XCircle className="h-3 w-3" /> Regressing
                  </span>
                )}
              </div>

              {/* Manager's Assessment */}
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-3.5 text-xs text-slate-300 leading-relaxed font-medium">
                <span className="text-blue-400 font-bold block mb-1 uppercase tracking-wider text-[10px]">
                  Manager's Current Assessment:
                </span>
                "{rep.trajectoryReason}"
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-4 gap-2 pt-1 text-center font-mono">
                <div className="rounded bg-slate-950 p-2 border border-slate-800">
                  <span className="text-[10px] uppercase font-semibold text-slate-500 block">Calls</span>
                  <span className="text-base font-bold text-white">{rep.totalCalls}</span>
                </div>
                <div className="rounded bg-slate-950 p-2 border border-slate-800">
                  <span className="text-[10px] uppercase font-semibold text-slate-500 block">Pain</span>
                  <span className="text-base font-bold text-blue-400">{rep.painPassRate}%</span>
                </div>
                <div className="rounded bg-slate-950 p-2 border border-slate-800">
                  <span className="text-[10px] uppercase font-semibold text-slate-500 block">Budget</span>
                  <span className="text-base font-bold text-emerald-400">{rep.budgetPassRate}%</span>
                </div>
                <div className="rounded bg-slate-950 p-2 border border-slate-800">
                  <span className="text-[10px] uppercase font-semibold text-slate-500 block">Script</span>
                  <span className="text-base font-bold text-amber-400">{rep.avgScriptScore}</span>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Link
                  href={`/reps/${rep.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 border border-slate-700 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 transition"
                >
                  View Historical Calls & Fixes <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

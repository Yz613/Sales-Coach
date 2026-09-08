"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { BarChart3, TrendingUp, AlertTriangle, ShieldCheck, Flame, Users, ArrowUpRight, CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";
import { apiPath } from "@/lib/utils";
import type { ExecutiveAnalytics } from "@/types";

export default function AnalyticsPage() {
  const [data, setData] = useState<ExecutiveAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(apiPath("/api/admin/analytics"))
      .then((res) => res.json())
      .then((resData) => {
        setData(resData);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading || !data) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading Executive Metrics & Benchmarks...
      </div>
    );
  }

  const outcomes = data.outcomesBreakdown;

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="rounded bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-blue-400 border border-blue-500/20">
              Executive Analytics
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Sales Performance & Pipeline Analytics
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Deep-dive metrics across rep execution, objection surrender patterns, and Sandler qualification distributions.
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="rounded-lg bg-slate-900 border border-slate-800 px-3 py-2">
            <span className="text-slate-500 uppercase block text-[10px]">Team Win Rate</span>
            <span className="text-xl font-bold text-emerald-400">{data.winRate}%</span>
          </div>
          <div className="rounded-lg bg-slate-900 border border-slate-800 px-3 py-2">
            <span className="text-slate-500 uppercase block text-[10px]">Total Calls Analyzed</span>
            <span className="text-xl font-bold text-white">{data.totalCalls}</span>
          </div>
        </div>
      </div>

      {/* Outcome Distribution Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" /> Meeting Booked
          </div>
          <div className="text-2xl font-bold text-white">{outcomes.booked}</div>
          <p className="text-xs text-slate-400">
            {data.totalCalls ? Math.round((outcomes.booked / data.totalCalls) * 100) : 0}% of all interactions
          </p>
        </div>

        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
            <XCircle className="h-3.5 w-3.5" /> Calls Dropped / Folded
          </div>
          <div className="text-2xl font-bold text-white">{outcomes.dropped}</div>
          <p className="text-xs text-slate-400">
            {data.totalCalls ? Math.round((outcomes.dropped / data.totalCalls) * 100) : 0}% surrendered early
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Unqualified
          </div>
          <div className="text-2xl font-bold text-white">{outcomes.unqualified}</div>
          <p className="text-xs text-slate-400">
            {data.totalCalls ? Math.round((outcomes.unqualified / data.totalCalls) * 100) : 0}% no budget or authority
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" /> Rescheduled / Follow-up
          </div>
          <div className="text-2xl font-bold text-white">{outcomes.rescheduled}</div>
          <p className="text-xs text-slate-400">
            {data.totalCalls ? Math.round((outcomes.rescheduled / data.totalCalls) * 100) : 0}% locked for sync
          </p>
        </div>
      </div>

      {/* Rep Benchmark Leaderboard */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/90 overflow-hidden">
        <div className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-400" /> Rep Head-to-Head Leaderboard
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Ranked comparison of win rates, script adherence discipline, budget qualification, and early fold counts.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="table-header">
              <tr>
                <th className="px-6 py-3.5">Rep & Role</th>
                <th className="px-6 py-3.5">Trajectory</th>
                <th className="px-6 py-3.5">Calls</th>
                <th className="px-6 py-3.5">Booked %</th>
                <th className="px-6 py-3.5">Script Adherence</th>
                <th className="px-6 py-3.5">Budget Pass %</th>
                <th className="px-6 py-3.5">Early Folds</th>
                <th className="px-6 py-3.5 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
              {data.repLeaderboard.map((rep, idx) => (
                <tr key={rep.repId} className="hover:bg-slate-800/30 transition">
                  <td className="px-6 py-4 font-sans">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-slate-400 font-mono">
                        #{idx + 1}
                      </span>
                      <div>
                        <Link href={`/reps/${rep.repId}`} className="font-semibold text-white hover:text-blue-400 transition">
                          {rep.repName}
                        </Link>
                        <div className="text-[11px] text-slate-400 font-normal">{rep.role}</div>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4 font-sans">
                    {rep.trajectory === "progressing" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400 border border-emerald-500/20">
                        Progressing
                      </span>
                    )}
                    {rep.trajectory === "stagnant" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-400 border border-amber-500/20">
                        Stagnant
                      </span>
                    )}
                    {rep.trajectory === "regressing" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-400 border border-rose-500/20">
                        Regressing
                      </span>
                    )}
                  </td>

                  <td className="px-6 py-4 text-white font-bold">{rep.totalCalls}</td>

                  <td className="px-6 py-4">
                    <span className={`font-bold ${rep.bookedRate >= 50 ? "text-emerald-400" : "text-slate-300"}`}>
                      {rep.bookedRate}% ({rep.meetingsBooked})
                    </span>
                  </td>

                  <td className="px-6 py-4">
                    <span className={`font-bold ${
                      rep.avgScriptScore >= 8
                        ? "text-emerald-400"
                        : rep.avgScriptScore >= 6
                        ? "text-amber-400"
                        : "text-rose-400"
                    }`}>
                      {rep.avgScriptScore} / 10
                    </span>
                  </td>

                  <td className="px-6 py-4">
                    <span className={rep.budgetPassRate >= 60 ? "text-emerald-400" : "text-amber-400"}>
                      {rep.budgetPassRate}%
                    </span>
                  </td>

                  <td className="px-6 py-4">
                    <span className={`font-bold ${rep.earlyFolds > 2 ? "text-rose-400" : "text-slate-400"}`}>
                      {rep.earlyFolds} flagged
                    </span>
                  </td>

                  <td className="px-6 py-4 text-right font-sans">
                    <Link
                      href={`/reps/${rep.repId}`}
                      className="rounded bg-slate-800 border border-slate-700 px-3 py-1 text-[11px] font-semibold text-white hover:bg-slate-700 transition inline-flex items-center gap-1"
                    >
                      Profile <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Objection Surrender Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-6 space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-wider">
              <Flame className="h-4 w-4" /> Objection Surrender Triggers
            </div>
            <h2 className="text-base font-bold text-white mt-1">Where Reps Are Folding Most Frequently</h2>
            <p className="text-xs text-slate-400">
              Ranked frequency of objections causing premature call termination across the team.
            </p>
          </div>

          <div className="space-y-3">
            {data.topObjectionsCausingSurrender.map((item, idx) => (
              <div key={idx} className="rounded-lg border border-slate-800 bg-slate-950 p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white">"{item.objection}"</span>
                  <span className="rounded bg-rose-500/10 px-2 py-0.5 text-rose-300 font-mono text-[11px] border border-rose-500/20 font-bold">
                    {item.percentage}% of surrenders
                  </span>
                </div>

                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-rose-500 h-1.5 rounded-full"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>

                <div className="text-xs text-emerald-300 bg-emerald-500/5 border border-emerald-500/20 rounded p-2 text-[11px]">
                  <strong className="text-emerald-400 block uppercase text-[9px] tracking-wider mb-0.5">Recommended Manager Pivot:</strong>
                  {item.recommendedPivot}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sandler Pillar Distribution Breakdown */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-6 space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-wider">
              <ShieldCheck className="h-4 w-4" /> Sandler Qualification Distribution
            </div>
            <h2 className="text-base font-bold text-white mt-1">Pillar Pass / Incomplete / Fail Split</h2>
            <p className="text-xs text-slate-400">
              How the team performs on Pain Discovery, Budget Qualification, and Decision Mapping.
            </p>
          </div>

          <div className="space-y-4 pt-1">
            {(["pain", "budget", "decision"] as const).map((pillar) => {
              const stats = data.sandlerDistribution[pillar];
              const total = stats.pass + stats.incomplete + stats.fail || 1;
              const passPct = Math.round((stats.pass / total) * 100);
              const incPct = Math.round((stats.incomplete / total) * 100);
              const failPct = Math.round((stats.fail / total) * 100);

              return (
                <div key={pillar} className="space-y-1.5 rounded-lg border border-slate-800 bg-slate-950 p-3.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold uppercase tracking-wider text-slate-200">
                      {pillar} Qualification
                    </span>
                    <span className="font-mono text-emerald-400 font-bold">{passPct}% Pass</span>
                  </div>

                  <div className="flex h-2.5 w-full rounded-full overflow-hidden bg-slate-800">
                    <div style={{ width: `${passPct}%` }} className="bg-emerald-500" title={`Pass: ${stats.pass}`} />
                    <div style={{ width: `${incPct}%` }} className="bg-amber-500" title={`Incomplete: ${stats.incomplete}`} />
                    <div style={{ width: `${failPct}%` }} className="bg-rose-500" title={`Fail: ${stats.fail}`} />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-1">
                    <span className="text-emerald-400">Pass: {stats.pass} ({passPct}%)</span>
                    <span className="text-amber-400">Incomplete: {stats.incomplete} ({incPct}%)</span>
                    <span className="text-rose-400">Fail: {stats.fail} ({failPct}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

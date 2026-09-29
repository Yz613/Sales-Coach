"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BarChart3, TrendingUp, AlertTriangle, ShieldCheck, Flame, Users, ArrowUpRight, CheckCircle2, XCircle, Clock, Loader2, MonitorPlay } from "lucide-react";
import { apiPath } from "@/lib/utils";
import { useAppAuth } from "@/lib/auth-context";
import type { ExecutiveAnalytics } from "@/types";

export default function AnalyticsPage() {
  const router = useRouter();
  const { isAdmin, isLoading: authLoading } = useAppAuth();
  const [data, setData] = useState<ExecutiveAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.replace("/calls");
    }
  }, [isAdmin, authLoading, router]);

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
      <div className="flex h-64 items-center justify-center text-[#6e6e73]">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading Executive Metrics & Benchmarks...
      </div>
    );
  }

  const outcomes = data.outcomesBreakdown;

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/[0.08] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-[#007AFF] border border-blue-500/20">
              Executive Analytics
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">
            Sales Performance & Pipeline Analytics
          </h1>
          <p className="text-xs text-[#6e6e73] mt-1.5">
            Deep-dive metrics across rep execution, the cookbook funnel, and {data.methodologyName} qualification.
          </p>
        </div>

        <div className="flex items-center gap-3 font-mono">
          <div className="rounded-2xl glass-card px-4 py-2.5">
            <span className="text-[#6e6e73] uppercase block text-[10px] tracking-wider font-sans font-medium">Team Win Rate</span>
            <span className="text-xl font-bold text-[#248A3D]">{data.winRate}%</span>
          </div>
          <div className="rounded-2xl glass-card px-4 py-2.5">
            <span className="text-[#6e6e73] uppercase block text-[10px] tracking-wider font-sans font-medium">Total Calls Analyzed</span>
            <span className="text-xl font-bold text-[#1d1d1f]">{data.totalCalls}</span>
          </div>
        </div>
      </div>

      {/* Outcome Distribution Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="rounded-2xl glass-card p-5 space-y-1.5">
          <div className="text-[11px] font-medium uppercase tracking-wider text-[#248A3D] flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" /> Meeting Booked
          </div>
          <div className="text-2xl font-bold text-[#1d1d1f]">{outcomes.booked}</div>
          <p className="text-xs text-[#6e6e73]">
            {data.totalCalls ? Math.round((outcomes.booked / data.totalCalls) * 100) : 0}% calendar lock
          </p>
        </div>

        <div className="rounded-2xl glass-card p-5 space-y-1.5">
          <div className="text-[11px] font-medium uppercase tracking-wider text-[#007AFF] flex items-center gap-1.5">
            <MonitorPlay className="h-4 w-4" /> Demo Agreed
          </div>
          <div className="text-2xl font-bold text-[#1d1d1f]">{outcomes.demoAgreed}</div>
          <p className="text-xs text-[#6e6e73]">
            {data.totalCalls ? Math.round((outcomes.demoAgreed / data.totalCalls) * 100) : 0}% yes, no calendar lock
          </p>
        </div>

        <div className="rounded-2xl glass-card p-5 space-y-1.5">
          <div className="text-[11px] font-medium uppercase tracking-wider text-[#FF3B30] flex items-center gap-1.5">
            <XCircle className="h-4 w-4" /> Calls Dropped / Folded
          </div>
          <div className="text-2xl font-bold text-[#1d1d1f]">{outcomes.dropped}</div>
          <p className="text-xs text-[#6e6e73]">
            {data.totalCalls ? Math.round((outcomes.dropped / data.totalCalls) * 100) : 0}% surrendered early
          </p>
        </div>

        <div className="rounded-2xl glass-card p-5 space-y-1.5">
          <div className="text-[11px] font-medium uppercase tracking-wider text-[#6e6e73] flex items-center gap-1.5">
            <Clock className="h-4 w-4" /> Unqualified
          </div>
          <div className="text-2xl font-bold text-[#1d1d1f]">{outcomes.unqualified}</div>
          <p className="text-xs text-[#6e6e73]">
            {data.totalCalls ? Math.round((outcomes.unqualified / data.totalCalls) * 100) : 0}% no budget or authority
          </p>
        </div>

        <div className="rounded-2xl glass-card p-5 space-y-1.5">
          <div className="text-[11px] font-medium uppercase tracking-wider text-[#007AFF] flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4" /> Rescheduled / Follow-up
          </div>
          <div className="text-2xl font-bold text-[#1d1d1f]">{outcomes.rescheduled}</div>
          <p className="text-xs text-[#6e6e73]">
            {data.totalCalls ? Math.round((outcomes.rescheduled / data.totalCalls) * 100) : 0}% locked for sync
          </p>
        </div>
      </div>

      {data.cookbookFunnel?.length > 0 && (
        <div className="rounded-2xl glass-card p-6 space-y-4">
          <div>
            <div className="flex items-center gap-2 text-[#007AFF] text-xs font-medium uppercase tracking-wider">
              <TrendingUp className="h-4 w-4" /> Cookbook funnel
            </div>
            <h2 className="text-base font-semibold text-[#1d1d1f] mt-1">Dials to proposals</h2>
            <p className="text-xs text-[#6e6e73] mt-0.5">
              Leading indicators from calls logged here, so scorecards have volume context. Each stage is a subset of the one before it.
            </p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {data.cookbookFunnel.map((step, index) => (
              <div key={step.key} className="rounded-2xl glass-inset border border-black/[0.08] p-4 space-y-1.5">
                <div className="text-[11px] font-medium uppercase tracking-wider text-[#6e6e73]">
                  {index + 1}. {step.label}
                </div>
                <div className="text-2xl font-bold text-[#1d1d1f]">{step.count}</div>
                <p className="text-xs text-[#6e6e73]">
                  {index === 0 ? "Logged calls" : `${step.rateFromPrevious}% of previous · ${step.rateFromStart}% of dials`}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rep Benchmark Leaderboard */}
      <div className="rounded-2xl glass-card overflow-hidden">
        <div className="border-b border-black/[0.08] px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#1d1d1f] tracking-tight flex items-center gap-2">
              <Users className="h-4 w-4 text-[#007AFF]" /> Rep Head-to-Head Leaderboard
            </h2>
            <p className="text-xs text-[#6e6e73] mt-0.5">
              Ranked comparison of win rates, script adherence discipline, budget qualification, and early fold counts.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-[#3a3a3c]">
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
            <tbody className="divide-y divide-black/[0.06] font-mono text-xs">
              {data.repLeaderboard.map((rep, idx) => (
                <tr key={rep.repId} className="hover:bg-black/[0.04] transition">
                  <td className="px-6 py-4 font-sans">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black/[0.04] text-[10px] font-bold text-[#6e6e73] font-mono">
                        #{idx + 1}
                      </span>
                      <div>
                        <Link href={`/reps/${rep.repId}`} className="font-semibold text-[#1d1d1f] hover:text-[#0071E3] transition">
                          {rep.repName}
                        </Link>
                        <div className="text-[11px] text-[#6e6e73] font-normal">{rep.role}</div>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4 font-sans">
                    {rep.trajectory === "progressing" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-[#248A3D] border border-emerald-500/20">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#34C759]" />
                        Progressing
                      </span>
                    )}
                    {rep.trajectory === "stagnant" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-[#C45500] border border-amber-500/20">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#FF9500]" />
                        Stagnant
                      </span>
                    )}
                    {rep.trajectory === "regressing" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-medium text-[#FF3B30] border border-rose-500/20">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#FF3B30]" />
                        Regressing
                      </span>
                    )}
                  </td>

                  <td className="px-6 py-4 text-[#1d1d1f] font-bold">{rep.totalCalls}</td>

                  <td className="px-6 py-4">
                    <span className={`font-bold ${rep.bookedRate >= 50 ? "text-[#248A3D]" : "text-[#3a3a3c]"}`}>
                      {rep.bookedRate}% ({rep.meetingsBooked})
                    </span>
                  </td>

                  <td className="px-6 py-4">
                    <span className={`font-bold ${
                      rep.avgScriptScore >= 8
                        ? "text-[#248A3D]"
                        : rep.avgScriptScore >= 6
                        ? "text-[#C45500]"
                        : "text-[#FF3B30]"
                    }`}>
                      {rep.avgScriptScore} / 10
                    </span>
                  </td>

                  <td className="px-6 py-4">
                    <span className={rep.budgetPassRate >= 60 ? "text-[#248A3D]" : "text-[#C45500]"}>
                      {rep.budgetPassRate}%
                    </span>
                  </td>

                  <td className="px-6 py-4">
                    <span className={`font-bold ${rep.earlyFolds > 2 ? "text-[#FF3B30]" : "text-[#6e6e73]"}`}>
                      {rep.earlyFolds} flagged
                    </span>
                  </td>

                  <td className="px-6 py-4 text-right font-sans">
                    <Link
                      href={`/reps/${rep.repId}`}
                      className="rounded-xl bg-black/[0.04] border border-black/[0.08] px-3.5 py-1.5 text-xs font-medium text-[#1d1d1f] hover:bg-black/[0.08] transition inline-flex items-center gap-1"
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
        <div className="rounded-2xl glass-card p-6 space-y-5">
          <div className="border-b border-black/[0.08] pb-4">
            <div className="flex items-center gap-2 text-[#FF3B30] text-xs font-medium uppercase tracking-wider">
              <Flame className="h-4 w-4" /> Objection Surrender Triggers
            </div>
            <h2 className="text-base font-semibold text-[#1d1d1f] mt-1">Where Reps Are Folding Most Frequently</h2>
            <p className="text-xs text-[#6e6e73] mt-0.5">
              Ranked frequency of objections causing premature call termination across the team.
            </p>
          </div>

          <div className="space-y-3">
            {data.topObjectionsCausingSurrender.map((item, idx) => (
              <div key={idx} className="rounded-xl glass-inset border border-black/[0.08] p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#1d1d1f]">"{item.objection}"</span>
                  <span className="rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[#D70015] font-mono text-[11px] border border-rose-500/20 font-bold">
                    {item.percentage}% of surrenders
                  </span>
                </div>

                <div className="w-full bg-black/[0.06] rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-[#D70015] h-1.5 rounded-full"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>

                <div className="text-xs text-[#248A3D] bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-2.5 text-[11px]">
                  <strong className="text-[#248A3D] block uppercase text-[9px] tracking-wider mb-0.5">Recommended Manager Pivot:</strong>
                  {item.recommendedPivot}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sandler Pillar Distribution Breakdown */}
        <div className="rounded-2xl glass-card p-6 space-y-5">
          <div className="border-b border-black/[0.08] pb-4">
            <div className="flex items-center gap-2 text-[#007AFF] text-xs font-medium uppercase tracking-wider">
              <ShieldCheck className="h-4 w-4" /> {data.methodologyName} qualification
            </div>
            <h2 className="text-base font-semibold text-[#1d1d1f] mt-1">Pillar Pass / Incomplete / Fail Split</h2>
            <p className="text-xs text-[#6e6e73] mt-0.5">
              How the team performs on {data.pillarLabels.pain}, {data.pillarLabels.budget}, and {data.pillarLabels.decision}.
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
                <div key={pillar} className="space-y-2 rounded-xl glass-inset border border-black/[0.08] p-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium uppercase tracking-wider text-[#1d1d1f]">
                      {data.pillarLabels[pillar]} Qualification
                    </span>
                    <span className="font-mono text-[#248A3D] font-bold">{passPct}% Pass</span>
                  </div>

                  <div className="flex h-2 w-full rounded-full overflow-hidden bg-black/[0.06]">
                    <div style={{ width: `${passPct}%` }} className="bg-emerald-500" title={`Pass: ${stats.pass}`} />
                    <div style={{ width: `${incPct}%` }} className="bg-amber-500" title={`Incomplete: ${stats.incomplete}`} />
                    <div style={{ width: `${failPct}%` }} className="bg-rose-500" title={`Fail: ${stats.fail}`} />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-[#6e6e73] font-mono pt-1">
                    <span className="text-[#248A3D]">Pass: {stats.pass} ({passPct}%)</span>
                    <span className="text-[#C45500]">Incomplete: {stats.incomplete} ({incPct}%)</span>
                    <span className="text-[#FF3B30]">Fail: {stats.fail} ({failPct}%)</span>
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

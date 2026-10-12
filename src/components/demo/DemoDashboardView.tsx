"use client";

import Link from "next/link";
import {
  TrendingUp,
  AlertTriangle,
  ShieldCheck,
  Flame,
  ArrowUpRight,
  CheckCircle2,
  Users,
} from "lucide-react";
import { DEMO_DASHBOARD, DEMO_CALLS, demoOverallScore } from "@/lib/demo/workspace";

export default function DemoDashboardView() {
  const { metrics, revenueGoal, dialSummary, repTrajectories } = DEMO_DASHBOARD;

  return (
    <div className="space-y-8">
      {/* 1. Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-[#1d1d1f]">Executive Sales Dashboard</h2>
        <p className="text-xs text-[#6e6e73] mt-0.5">
          Real-time qualification health, pipeline progression, and rep trajectories across the team.
        </p>
      </div>

      {/* 2. Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl glass-card p-5 space-y-2 border border-black/[0.06]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#6e6e73]">Pain Qualification</span>
            <ShieldCheck className="h-4 w-4 text-[#007AFF]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black font-mono text-[#1d1d1f]">{metrics.painPassRate}%</span>
            <span className="text-xs text-[#6e6e73]">pass rate</span>
          </div>
          <p className="text-[11px] text-[#86868b] leading-relaxed">
            Uncovering real operational bottlenecks vs. surface feature requests.
          </p>
        </div>

        <div className="rounded-2xl glass-card p-5 space-y-2 border border-black/[0.06]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#6e6e73]">Budget Qualification</span>
            <TrendingUp className="h-4 w-4 text-[#248A3D]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black font-mono text-[#248A3D]">{metrics.budgetPassRate}%</span>
            <span className="text-xs text-[#6e6e73]">pass rate</span>
          </div>
          <p className="text-[11px] text-[#86868b] leading-relaxed">
            Directly asking about cost thresholds & financial approval criteria.
          </p>
        </div>

        <div className="rounded-2xl glass-card p-5 space-y-2 border border-black/[0.06]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#6e6e73]">Decision Authority</span>
            <AlertTriangle className="h-4 w-4 text-[#FF9500]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black font-mono text-[#1d1d1f]">{metrics.decisionPassRate}%</span>
            <span className="text-xs text-[#6e6e73]">pass rate</span>
          </div>
          <p className="text-[11px] text-[#86868b] leading-relaxed">
            Mapping economic buyers, sign-off criteria, and firm timelines.
          </p>
        </div>

        <div className="rounded-2xl glass-card p-5 space-y-2 border border-black/[0.06]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#6e6e73]">Script Adherence</span>
            <Flame className="h-4 w-4 text-[#C45500]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black font-mono text-[#1d1d1f]">{metrics.scriptAdherence}</span>
            <span className="text-xs text-[#6e6e73]">/ 10 avg</span>
          </div>
          <p className="text-[11px] text-[#86868b] leading-relaxed">
            Execution discipline against prescribed stage playbooks.
          </p>
        </div>
      </div>

      {/* 3. Revenue Goal & Dial Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl glass-card p-6 space-y-4 border border-black/[0.06]">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#007AFF]">Revenue Progress</span>
              <h3 className="text-base font-bold text-[#1d1d1f] mt-0.5">Quarterly Target Attainment</h3>
            </div>
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 font-mono text-xs font-bold text-[#248A3D] border border-emerald-500/20">
              {revenueGoal.attainmentPercent}% of Goal
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between text-xs font-mono">
              <span className="text-[#6e6e73]">Closed: ${(revenueGoal.currentAmount).toLocaleString()}</span>
              <span className="font-semibold text-[#1d1d1f]">Target: ${(revenueGoal.targetAmount).toLocaleString()}</span>
            </div>
            <div className="h-3 w-full rounded-full bg-[#E5E5EA] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#248A3D] transition-all"
                style={{ width: `${revenueGoal.attainmentPercent}%` }}
              />
            </div>
            <p className="text-[11px] text-[#86868b]">
              Weighted Pipeline: ${(revenueGoal.pipelineAmount).toLocaleString()} in active evaluation.
            </p>
          </div>
        </div>

        <div className="rounded-2xl glass-card p-6 space-y-4 border border-black/[0.06]">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#007AFF]">Outbound Dial Funnel</span>
            <h3 className="text-base font-bold text-[#1d1d1f] mt-0.5">Team Conversion Benchmarks</h3>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center font-mono">
            <div className="rounded-xl glass-inset p-3 border border-black/[0.06]">
              <span className="text-[10px] text-[#86868b] uppercase block font-sans">Connect Rate</span>
              <span className="text-base font-bold text-[#007AFF]">{dialSummary.connectRate}%</span>
              <span className="text-[10px] text-[#6e6e73] block">{dialSummary.connects} / {dialSummary.dials} dials</span>
            </div>
            <div className="rounded-xl glass-inset p-3 border border-black/[0.06]">
              <span className="text-[10px] text-[#86868b] uppercase block font-sans">Booked Rate</span>
              <span className="text-base font-bold text-[#248A3D]">{dialSummary.closePerConnect}%</span>
              <span className="text-[10px] text-[#6e6e73] block">{dialSummary.meetings} booked</span>
            </div>
            <div className="rounded-xl glass-inset p-3 border border-black/[0.06]">
              <span className="text-[10px] text-[#86868b] uppercase block font-sans">Close Rate</span>
              <span className="text-base font-bold text-[#1d1d1f]">{dialSummary.closeRate}%</span>
              <span className="text-[10px] text-[#6e6e73] block">{dialSummary.closes} won</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Rep Trajectories */}
      <div className="rounded-2xl glass-card p-6 space-y-4 border border-black/[0.06]">
        <div className="flex items-center justify-between border-b border-black/[0.08] pb-3">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#007AFF]">Team Pipeline</span>
            <h3 className="text-base font-bold text-[#1d1d1f] mt-0.5">Sales Rep Progression & Assessments</h3>
          </div>
          <span className="text-xs text-[#6e6e73] font-medium">{repTrajectories.length} Reps Monitored</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {repTrajectories.map((rep) => {
            const isProgressing = rep.trajectory === "progressing";
            const isStagnant = rep.trajectory === "stagnant";
            return (
              <div key={rep.id} className="rounded-xl glass-inset p-4 space-y-3 border border-black/[0.06]">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-[#1d1d1f]">{rep.name}</h4>
                    <p className="text-[11px] text-[#6e6e73]">{rep.role}</p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                      isProgressing
                        ? "bg-emerald-500/10 text-[#248A3D] border-emerald-500/20"
                        : isStagnant
                        ? "bg-amber-500/10 text-[#C45500] border-amber-500/20"
                        : "bg-rose-500/10 text-[#FF3B30] border-rose-500/20"
                    }`}
                  >
                    {rep.trajectory.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-[#3a3a3c] italic leading-relaxed">"{rep.reason}"</p>
                <div className="grid grid-cols-4 gap-2 text-center font-mono text-[11px] pt-1 border-t border-black/[0.06]">
                  <div>
                    <span className="text-[#86868b] block text-[9px] uppercase font-sans">Calls</span>
                    <span className="font-semibold">{rep.totalCalls}</span>
                  </div>
                  <div>
                    <span className="text-[#86868b] block text-[9px] uppercase font-sans">Pain</span>
                    <span className="font-semibold text-[#007AFF]">{rep.painPassRate}%</span>
                  </div>
                  <div>
                    <span className="text-[#86868b] block text-[9px] uppercase font-sans">Budget</span>
                    <span className="font-semibold text-[#248A3D]">{rep.budgetPassRate}%</span>
                  </div>
                  <div>
                    <span className="text-[#86868b] block text-[9px] uppercase font-sans">Script</span>
                    <span className="font-semibold text-[#C45500]">{rep.avgScriptScore}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Recent Calls Feed */}
      <div className="rounded-2xl glass-card p-6 space-y-4 border border-black/[0.06]">
        <div className="flex items-center justify-between border-b border-black/[0.08] pb-3">
          <h3 className="text-base font-bold text-[#1d1d1f]">Recent Call Evaluations</h3>
          <span className="text-xs font-semibold text-[#007AFF]">Live Sample Feed</span>
        </div>
        <div className="divide-y divide-black/[0.06]">
          {DEMO_CALLS.map((call) => (
            <Link
              key={call.id}
              href={`/demo/${call.id}`}
              className="flex items-center justify-between py-3 hover:bg-black/[0.02] px-2 rounded-xl transition"
            >
              <div>
                <p className="text-sm font-semibold text-[#1d1d1f]">{call.company}</p>
                <p className="text-xs text-[#6e6e73]">
                  {call.repName} · {call.stage} · {call.outcome}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs font-bold text-[#1d1d1f]">
                  {demoOverallScore(call).toFixed(1)} / 10
                </span>
                <ArrowUpRight className="h-4 w-4 text-[#86868b]" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  TrendingUp,
  AlertTriangle,
  ShieldCheck,
  Flame,
  ArrowUpRight,
  CheckCircle2,
  XCircle,
  Clock,
  GraduationCap,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { Call, SuperAdminReport } from "@/types";
import { outcomeBadgeClass } from "@/lib/coreOutcome";
import { callPartySubtitle } from "@/lib/callLabel";
import SortableBoard from "./SortableBoard";
import {
  DASHBOARD_METRIC_STORAGE_KEY,
  DASHBOARD_SECTION_STORAGE_KEY,
  DEFAULT_METRIC_ORDER,
  DEFAULT_SECTION_ORDER,
  readStoredOrder,
  writeStoredOrder,
  type MetricId,
  type SectionId,
} from "@/lib/dashboardLayout";
import type { SalesMethodology } from "@/lib/methodology";
import RevenueGoal from "./RevenueGoal";

export default function DashboardBoard({
  report,
  recentCalls,
  needsCoachSetup,
  methodology,
  teamCloseRate,
  loggedCalls,
  repCount,
}: {
  report: SuperAdminReport;
  recentCalls: Call[];
  needsCoachSetup: boolean;
  methodology: SalesMethodology;
  teamCloseRate: number;
  loggedCalls: number;
  repCount: number;
}) {
  const progressingCount = report.repTrajectories.filter((r) => r.trajectory === "progressing").length;
  const stagnantCount = report.repTrajectories.filter((r) => r.trajectory === "stagnant").length;
  const regressingCount = report.repTrajectories.filter((r) => r.trajectory === "regressing").length;

  const [metricOrder, setMetricOrder] = useState<MetricId[]>([...DEFAULT_METRIC_ORDER]);
  const [sectionOrder, setSectionOrder] = useState<SectionId[]>([...DEFAULT_SECTION_ORDER]);

  useEffect(() => {
    setMetricOrder(readStoredOrder(DASHBOARD_METRIC_STORAGE_KEY, DEFAULT_METRIC_ORDER));
    setSectionOrder(readStoredOrder(DASHBOARD_SECTION_STORAGE_KEY, DEFAULT_SECTION_ORDER));
  }, []);

  const updateMetrics = (next: MetricId[]) => {
    setMetricOrder(next);
    writeStoredOrder(DASHBOARD_METRIC_STORAGE_KEY, next);
  };

  const updateSections = (next: SectionId[]) => {
    setSectionOrder(next);
    writeStoredOrder(DASHBOARD_SECTION_STORAGE_KEY, next);
  };

  const metricCards: Record<MetricId, { title: string; value: string; unit: string; blurb: string; icon: typeof ShieldCheck; iconClass: string }> = {
    pain: {
      title: methodology.pillars.find((pillar) => pillar.key === "pain")?.cardTitle || "Pain Qualification",
      value: `${report.teamSandlerRates.painPassRate}%`,
      unit: "pass rate",
      blurb: methodology.pillars.find((pillar) => pillar.key === "pain")?.summary || "Uncovering real operational bottlenecks vs. surface feature requests.",
      icon: ShieldCheck,
      iconClass: "text-[#007AFF]",
    },
    budget: {
      title: methodology.pillars.find((pillar) => pillar.key === "budget")?.cardTitle || "Budget Qualification",
      value: `${report.teamSandlerRates.budgetPassRate}%`,
      unit: "pass rate",
      blurb: methodology.pillars.find((pillar) => pillar.key === "budget")?.summary || "Directly asking about cost thresholds & financial commitments.",
      icon: TrendingUp,
      iconClass: "text-[#248A3D]",
    },
    decision: {
      title: methodology.pillars.find((pillar) => pillar.key === "decision")?.cardTitle || "Decision Authority",
      value: `${report.teamSandlerRates.decisionPassRate}%`,
      unit: "pass rate",
      blurb: methodology.pillars.find((pillar) => pillar.key === "decision")?.summary || "Mapping economic buyers, sign-off criteria, and firm timelines.",
      icon: AlertTriangle,
      iconClass: "text-[#C45500]",
    },
    script: {
      title: "Script Adherence Avg",
      value: `${report.teamSandlerRates.avgScriptAdherence}`,
      unit: "/ 10",
      blurb: "Blocking-and-tackling discipline without freelancing or rushing.",
      icon: Flame,
      iconClass: "text-[#FF3B30]",
    },
  };

  const sections: Record<SectionId, ReactNode> = {
    metrics: (
      <SortableBoard
        scope="metrics"
        ids={metricOrder}
        onReorder={updateMetrics}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        renderItem={(id, handle) => {
          const card = metricCards[id];
          const Icon = card.icon;
          return (
            <div className="rounded-2xl glass-card glass-card-hover p-5 h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#6e6e73]">{card.title}</span>
                  <div className="flex items-center gap-1.5">
                    {handle}
                    <div className="p-1.5 rounded-xl bg-black/[0.04] border border-black/[0.08]">
                      <Icon className={`h-4 w-4 ${card.iconClass}`} />
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-bold tracking-tight text-[#1d1d1f] font-mono">{card.value}</span>
                  <span className="text-xs text-[#6e6e73]">{card.unit}</span>
                </div>
              </div>
              <p className="mt-3 text-xs text-[#6e6e73] leading-relaxed">{card.blurb}</p>
            </div>
          );
        }}
      />
    ),
    reps: (
      <div className="rounded-2xl glass-card overflow-hidden">
        <div className="border-b border-black/[0.08] px-6 py-5 flex items-center justify-between bg-black/[0.02]">
          <div>
            <h2 className="text-base font-bold text-[#1d1d1f] tracking-tight">Rep Progression & Manager Take</h2>
            <p className="text-xs text-[#6e6e73] mt-0.5">
              Identifies who is progressing, who has hit a plateau, and who is regressing on key sales categories.
            </p>
          </div>
          <Link href="/reps" className="text-xs font-semibold text-[#007AFF] hover:text-[#0071E3] flex items-center gap-1 transition">
            View All Reps <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="divide-y divide-black/[0.06]">
          {report.repTrajectories.map((rep) => {
            const isProgressing = rep.trajectory === "progressing";
            const isStagnant = rep.trajectory === "stagnant";
            const isRegressing = rep.trajectory === "regressing";
            return (
              <div key={rep.repId} className="p-6 hover:bg-black/[0.03] transition flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Link href={`/reps/${rep.repId}`} className="text-base font-bold text-[#1d1d1f] hover:text-[#0071E3] transition">
                      {rep.repName}
                    </Link>
                    {isProgressing && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-0.5 text-xs font-semibold text-[#248A3D] border border-emerald-500/25">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#248A3D]" /> Progressing
                      </span>
                    )}
                    {isStagnant && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-0.5 text-xs font-semibold text-[#C45500] border border-amber-500/25">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#C45500]" /> Stagnant
                      </span>
                    )}
                    {isRegressing && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-3 py-0.5 text-xs font-semibold text-[#D70015] border border-rose-500/25">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#D70015]" /> Regressing
                      </span>
                    )}
                    <span className="text-xs text-[#6e6e73] font-mono bg-black/[0.04] px-2.5 py-0.5 rounded-full border border-black/[0.06]">{rep.callsCount} calls reviewed</span>
                  </div>
                  <p className="text-sm text-[#3a3a3c] leading-relaxed font-normal">"{rep.managerRationale}"</p>
                  <div className="flex items-center gap-2 pt-1 text-xs">
                    <span className="text-[#6e6e73] uppercase font-semibold text-[10px] tracking-wider">Top Active Struggle:</span>
                    <span className="rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[#D70015] border border-rose-500/20 font-medium">
                      {rep.topActiveStruggle}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <div className="text-xs uppercase font-semibold text-[#6e6e73] tracking-wider">Recent Script Score</div>
                    <div className="text-xl font-bold text-[#1d1d1f] mt-0.5 font-mono">
                      {rep.recentScriptScore} <span className="text-xs text-[#6e6e73] font-normal">/ 10</span>
                    </div>
                  </div>
                  <Link
                    href={`/reps/${rep.repId}`}
                    className="rounded-xl border border-black/[0.1] bg-black/[0.04] hover:bg-black/[0.08] px-4 py-2 text-xs font-semibold text-[#1d1d1f] transition"
                  >
                    View History
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    ),
    leaks: (
      <div className="rounded-2xl glass-card p-6 sm:p-7 space-y-5">
        <div className="border-b border-black/[0.08] pb-4">
          <div className="flex items-center gap-2 text-[#FF3B30] text-xs font-bold uppercase tracking-wider">
            <Flame className="h-4 w-4" /> The "Fight for the Win" Team Audit
          </div>
          <h2 className="text-lg font-bold text-[#1d1d1f] mt-1">Systemic Pipeline Leaks & Manager Directives</h2>
          <p className="text-xs text-[#6e6e73] mt-0.5">
            Key categories where reps are folding early, ducking budget talk, or giving up on active objections.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {report.systemicTeamLeaks.map((leak, idx) => (
            <div key={idx} className="rounded-2xl glass-inset p-5 flex flex-col justify-between space-y-3.5 border border-black/[0.06] hover:border-black/[0.1] transition">
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-bold text-[#FF3B30]">Leak #{idx + 1}</span>
                  <span className="rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[#D70015] font-mono text-[10px] border border-rose-500/20 font-bold">
                    {leak.frequency}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-[#1d1d1f]">{leak.title}</h3>
                <p className="text-xs text-[#6e6e73] mt-1.5 leading-relaxed">{leak.description}</p>
              </div>
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.08] p-3.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#007AFF] block mb-1">Manager Directive</span>
                <p className="text-xs text-[#1d1d1f] leading-snug font-medium italic">"{leak.actionableTeamDirective}"</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    calls: (
      <div className="rounded-2xl glass-card overflow-hidden">
        <div className="border-b border-black/[0.08] px-6 py-5 flex items-center justify-between bg-black/[0.02]">
          <div>
            <h2 className="text-base font-bold text-[#1d1d1f] tracking-tight">Recent Call Evaluations</h2>
            <p className="text-xs text-[#6e6e73] mt-0.5">
              {methodology.id === "sandler"
                ? "Live evaluations scored against Sandler: Pain, Budget, Decision, then the skill checklist."
                : `Live evaluations scored against ${methodology.name}.`}
            </p>
          </div>
          <Link href="/calls" className="text-xs font-semibold text-[#007AFF] hover:text-[#0071E3] flex items-center gap-1 transition">
            View All Calls <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-[#3a3a3c]">
            <thead className="table-header">
              <tr>
                <th className="px-6 py-3.5">Rep & Prospect</th>
                <th className="px-6 py-3.5">Stage</th>
                <th className="px-6 py-3.5">{methodology.name}</th>
                <th className="px-6 py-3.5">Script Score</th>
                <th className="px-6 py-3.5">Core Outcome</th>
                <th className="px-6 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.06]">
              {recentCalls.map((call) => {
                const ev = call.evaluation;
                return (
                  <tr key={call.id} className="hover:bg-black/[0.03] transition">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-[#1d1d1f]">{call.repName}</div>
                      <div className="text-xs text-[#6e6e73]">{callPartySubtitle(call)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded-full bg-black/[0.04] px-2.5 py-0.5 text-xs text-[#3a3a3c] border border-black/[0.08]">{call.callStage}</span>
                    </td>
                    <td className="px-6 py-4">
                      {ev ? (
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          {(["pain", "budget", "decision"] as const).map((key) => {
                            const status = ev.sandlerBreakdown[key].status;
                            const letter = key[0].toUpperCase();
                            return (
                              <span
                                key={key}
                                title={`${key}: ${status}`}
                                className={`px-2 py-0.5 rounded-md font-bold ${
                                  status === "Pass"
                                    ? "bg-emerald-500/20 text-[#248A3D]"
                                    : status === "Incomplete"
                                    ? "bg-amber-500/20 text-[#C45500]"
                                    : "bg-rose-500/20 text-[#FF3B30]"
                                }`}
                              >
                                {letter}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-xs text-[#86868b] font-mono">Analyzing...</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {ev ? (
                        <span className={`text-sm font-bold font-mono ${
                          ev.sandlerBreakdown.scriptAdherence.score >= 8
                            ? "text-[#248A3D]"
                            : ev.sandlerBreakdown.scriptAdherence.score >= 6
                            ? "text-[#C45500]"
                            : "text-[#FF3B30]"
                        }`}>
                          {ev.sandlerBreakdown.scriptAdherence.score} / 10
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${outcomeBadgeClass(call.coreOutcome)}`}>
                        {call.coreOutcome}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/calls/${call.id}`}
                        className="rounded-xl bg-blue-600/10 border border-blue-500/30 px-3.5 py-1.5 text-xs font-semibold text-[#007AFF] hover:bg-[#0071E3] hover:text-white transition inline-block"
                      >
                        Review Breakdown
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    ),
  };

  const sectionTitles: Record<SectionId, string> = {
    metrics: "Qualification metrics",
    reps: "Rep progression",
    leaks: "Pipeline leaks",
    calls: "Recent calls",
  };

  return (
    <div className="space-y-8">
      {needsCoachSetup && (
        <div className="rounded-3xl border border-blue-500/25 bg-white p-6 sm:p-8 shadow-[0_4px_24px_rgba(0,122,255,0.06)]">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5 justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-500/10 text-[#007AFF] border border-blue-500/20">
                <GraduationCap className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#1d1d1f] tracking-tight">Build your AI Sales Coach</h2>
                <p className="text-sm text-[#3a3a3c] mt-1 max-w-2xl leading-relaxed">
                  Before you review calls, answer a few quick questions so the coach evaluates every call in your exact image — your standards, your non-negotiables, your tone.
                </p>
              </div>
            </div>
            <Link
              href="/coach"
              className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-[#007AFF] hover:bg-[#0071E3] px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition active:scale-95"
            >
              <GraduationCap className="h-4 w-4" /> Build my coach
            </Link>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-black/[0.08] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-0.5 text-xs font-semibold uppercase tracking-wider text-[#007AFF] border border-blue-500/20">
              Super Admin Intelligence
            </span>
            <span className="text-xs text-[#6e6e73] font-mono">Updated {formatDate(report.generatedAt)}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1d1d1f]">
            Team Pipeline Execution & Rep Progression
          </h1>
          <p className="text-sm text-[#6e6e73] mt-1 max-w-3xl">
            Drag the grip on any metric or section to rearrange this dashboard. Your layout stays on this browser.
          </p>
        </div>
        <div className="flex items-center gap-3 glass-card rounded-full border border-black/[0.08] px-4 py-2 text-xs">
          <div className="flex items-center gap-1.5 text-[#248A3D] font-semibold">
            <span className="h-2 w-2 rounded-full bg-[#34C759]" />
            {progressingCount} Progressing
          </div>
          <span className="text-black/20 font-light">|</span>
          <div className="flex items-center gap-1.5 text-[#C45500] font-semibold">
            <span className="h-2 w-2 rounded-full bg-[#FF9500]" />
            {stagnantCount} Stagnant
          </div>
          <span className="text-black/20 font-light">|</span>
          <div className="flex items-center gap-1.5 text-[#FF3B30] font-semibold">
            <span className="h-2 w-2 rounded-full bg-[#FF3B30]" />
            {regressingCount} Regressing
          </div>
        </div>
      </div>

      <RevenueGoal teamCloseRate={teamCloseRate} loggedCalls={loggedCalls} repCount={repCount} />

      <SortableBoard
        scope="sections"
        ids={sectionOrder}
        onReorder={updateSections}
        className="space-y-8"
        renderItem={(id, handle) => (
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-xl border border-black/[0.06] bg-[#F5F5F7] px-3 py-1.5 text-[10px] uppercase tracking-wider font-semibold text-[#86868b]">
              {handle}
              <span>Drag to move {sectionTitles[id]}</span>
            </div>
            {sections[id]}
          </div>
        )}
      />
    </div>
  );
}

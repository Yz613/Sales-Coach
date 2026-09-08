import Link from "next/link";
import { getSuperAdminReport, getAllCalls } from "@/lib/db/service";
import { TrendingUp, AlertTriangle, ShieldCheck, Flame, ArrowUpRight, CheckCircle2, XCircle, Clock } from "lucide-react";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SuperAdminDashboard() {
  const report = await getSuperAdminReport();
  const allCalls = await getAllCalls();
  const recentCalls = allCalls.slice(0, 6);

  const progressingCount = report.repTrajectories.filter((r) => r.trajectory === "progressing").length;
  const stagnantCount = report.repTrajectories.filter((r) => r.trajectory === "stagnant").length;
  const regressingCount = report.repTrajectories.filter((r) => r.trajectory === "regressing").length;

  return (
    <div className="space-y-8">
      {/* Top Banner / Executive Briefing */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-blue-400 border border-blue-500/20">
              Super Admin Intelligence
            </span>
            <span className="text-xs text-slate-400 font-mono">Updated {formatDate(report.generatedAt)}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Team Pipeline Execution & Rep Progression
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-3xl">
            Real-time audit of B2B call execution, Sandler qualification compliance, early objection surrenders, and historical rep trajectory.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs">
            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              {progressingCount} Progressing
            </div>
            <div className="text-slate-600">|</div>
            <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              {stagnantCount} Stagnant
            </div>
            <div className="text-slate-600">|</div>
            <div className="flex items-center gap-1.5 text-rose-400 font-semibold">
              <span className="h-2 w-2 rounded-full bg-rose-400" />
              {regressingCount} Regressing
            </div>
          </div>
        </div>
      </div>

      {/* Sandler Qualification & Adherence KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Pain Qualification</span>
            <ShieldCheck className="h-4 w-4 text-blue-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-white">
              {report.teamSandlerRates.painPassRate}%
            </span>
            <span className="text-xs text-slate-400">pass rate</span>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Uncovering real operational bottlenecks vs. surface feature requests.
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Budget Qualification</span>
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-white">
              {report.teamSandlerRates.budgetPassRate}%
            </span>
            <span className="text-xs text-slate-400">pass rate</span>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Directly asking about cost thresholds & financial commitments.
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Decision Authority</span>
            <AlertTriangle className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-white">
              {report.teamSandlerRates.decisionPassRate}%
            </span>
            <span className="text-xs text-slate-400">pass rate</span>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Mapping economic buyers, sign-off criteria, and firm timelines.
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Script Adherence Avg</span>
            <Flame className="h-4 w-4 text-rose-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-white">
              {report.teamSandlerRates.avgScriptAdherence}
            </span>
            <span className="text-xs text-slate-400">/ 10</span>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Blocking-and-tackling discipline without freelancing or rushing.
          </p>
        </div>
      </div>

      {/* Rep Progression Matrix */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/90 overflow-hidden">
        <div className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Rep Progression & Manager Take</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Identifies who is progressing, who has hit a plateau, and who is regressing on key sales categories.
            </p>
          </div>
          <Link
            href="/reps"
            className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition"
          >
            View All Reps <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="divide-y divide-slate-800/60">
          {report.repTrajectories.map((rep) => {
            const isProgressing = rep.trajectory === "progressing";
            const isStagnant = rep.trajectory === "stagnant";
            const isRegressing = rep.trajectory === "regressing";

            return (
              <div key={rep.repId} className="p-6 hover:bg-slate-800/30 transition flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1.5 max-w-2xl">
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/reps/${rep.repId}`}
                      className="text-base font-bold text-white hover:text-blue-400 transition"
                    >
                      {rep.repName}
                    </Link>

                    {isProgressing && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="h-3 w-3" /> Progressing
                      </span>
                    )}

                    {isStagnant && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-400 border border-amber-500/20">
                        <Clock className="h-3 w-3" /> Stagnant
                      </span>
                    )}

                    {isRegressing && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-400 border border-rose-500/20">
                        <XCircle className="h-3 w-3" /> Regressing
                      </span>
                    )}

                    <span className="text-xs text-slate-400 font-mono">
                      {rep.callsCount} calls reviewed
                    </span>
                  </div>

                  <p className="text-sm text-slate-300 leading-relaxed font-medium">
                    "{rep.managerRationale}"
                  </p>

                  <div className="flex items-center gap-2 pt-1 text-xs">
                    <span className="text-slate-400 uppercase font-semibold text-[10px] tracking-wider">Top Active Struggle:</span>
                    <span className="rounded bg-slate-800/80 px-2 py-0.5 text-rose-300 border border-rose-500/20 font-medium">
                      {rep.topActiveStruggle}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <div className="text-xs uppercase font-semibold text-slate-400 tracking-wider">Recent Script Score</div>
                    <div className="text-xl font-bold text-white mt-0.5">
                      {rep.recentScriptScore} <span className="text-xs text-slate-400 font-normal">/ 10</span>
                    </div>
                  </div>

                  <Link
                    href={`/reps/${rep.repId}`}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-700 transition"
                  >
                    View History
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Systemic Team Leaks (The "Fight for the Win" Team Audit) */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-6 space-y-4">
        <div className="border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-wider">
            <Flame className="h-4 w-4" /> The "Fight for the Win" Team Audit
          </div>
          <h2 className="text-lg font-bold text-white mt-1">Systemic Pipeline Leaks & Manager Directives</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Key categories where reps are folding early, ducking budget talk, or giving up on active objections.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {report.systemicTeamLeaks.map((leak, idx) => (
            <div key={idx} className="rounded-lg border border-slate-800 bg-slate-950 p-4 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-bold text-rose-400">Leak #{idx + 1}</span>
                  <span className="rounded bg-rose-500/10 px-2 py-0.5 text-rose-300 font-mono text-[10px] border border-rose-500/20">
                    {leak.frequency}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-white">{leak.title}</h3>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  {leak.description}
                </p>
              </div>

              <div className="rounded-md border border-blue-500/20 bg-blue-500/5 p-3">
                <span className="text-[10px] uppercase font-bold tracking-wider text-blue-400 block mb-1">
                  Manager Directive
                </span>
                <p className="text-xs text-slate-200 leading-snug font-medium italic">
                  "{leak.actionableTeamDirective}"
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Evaluated Calls Bank */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/90 overflow-hidden">
        <div className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Recent Call Evaluations</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Live evaluations scored against the 5 coaching dimensions.
            </p>
          </div>
          <Link
            href="/calls"
            className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition"
          >
            View All Calls <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="table-header">
              <tr>
                <th className="px-6 py-3">Rep & Prospect</th>
                <th className="px-6 py-3">Stage</th>
                <th className="px-6 py-3">Sandler (P / B / D)</th>
                <th className="px-6 py-3">Script Score</th>
                <th className="px-6 py-3">Core Outcome</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {recentCalls.map((call) => {
                const ev = call.evaluation;
                const isBooked = call.coreOutcome.toLowerCase().includes("booked");

                return (
                  <tr key={call.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white">{call.repName}</div>
                      <div className="text-xs text-slate-400">{call.prospectCompany} • {call.prospectName}</div>
                    </td>

                    <td className="px-6 py-4">
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300 border border-slate-700">
                        {call.callStage}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      {ev ? (
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          <span
                            title={`Pain: ${ev.sandlerBreakdown.pain.status}`}
                            className={`px-1.5 py-0.5 rounded font-bold ${
                              ev.sandlerBreakdown.pain.status === "Pass"
                                ? "bg-emerald-500/20 text-emerald-400"
                                : ev.sandlerBreakdown.pain.status === "Incomplete"
                                ? "bg-amber-500/20 text-amber-400"
                                : "bg-rose-500/20 text-rose-400"
                            }`}
                          >
                            P
                          </span>
                          <span
                            title={`Budget: ${ev.sandlerBreakdown.budget.status}`}
                            className={`px-1.5 py-0.5 rounded font-bold ${
                              ev.sandlerBreakdown.budget.status === "Pass"
                                ? "bg-emerald-500/20 text-emerald-400"
                                : ev.sandlerBreakdown.budget.status === "Incomplete"
                                ? "bg-amber-500/20 text-amber-400"
                                : "bg-rose-500/20 text-rose-400"
                            }`}
                          >
                            B
                          </span>
                          <span
                            title={`Decision: ${ev.sandlerBreakdown.decision.status}`}
                            className={`px-1.5 py-0.5 rounded font-bold ${
                              ev.sandlerBreakdown.decision.status === "Pass"
                                ? "bg-emerald-500/20 text-emerald-400"
                                : ev.sandlerBreakdown.decision.status === "Incomplete"
                                ? "bg-amber-500/20 text-amber-400"
                                : "bg-rose-500/20 text-rose-400"
                            }`}
                          >
                            D
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500 font-mono">Analyzing...</span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      {ev ? (
                        <span className={`text-sm font-bold font-mono ${
                          ev.sandlerBreakdown.scriptAdherence.score >= 8
                            ? "text-emerald-400"
                            : ev.sandlerBreakdown.scriptAdherence.score >= 6
                            ? "text-amber-400"
                            : "text-rose-400"
                        }`}>
                          {ev.sandlerBreakdown.scriptAdherence.score} / 10
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ${
                        isBooked
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-slate-800 text-slate-400 border border-slate-700"
                      }`}>
                        {call.coreOutcome}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/calls/${call.id}`}
                        className="rounded bg-blue-600/10 border border-blue-500/30 px-3 py-1 text-xs font-semibold text-blue-400 hover:bg-blue-600 hover:text-white transition"
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
    </div>
  );
}

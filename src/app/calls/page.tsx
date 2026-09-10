import Link from "next/link";
import { getAllCalls } from "@/lib/db/service";
import { rankCalls, getPrimaryIssue } from "@/lib/callInsights";
import { ArrowUpRight, Trophy, AlertTriangle, CheckCircle2 } from "lucide-react";
import ReanalyzeCallsBar from "@/components/ReanalyzeCallsBar";
import ReanalyzeButton from "@/components/ReanalyzeButton";
import { resolveAiSettings } from "@/lib/ai/settings";
import { getProvider } from "@/lib/ai/providers";
import { usedLlmReview } from "@/lib/evaluations";

export const dynamic = "force-dynamic";

export default async function CallBankPage() {
  const rankedCalls = rankCalls(await getAllCalls());
  const ai = await resolveAiSettings();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="rounded bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-blue-400 border border-blue-500/20">
              Call Bank
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Ranked Calls & Evaluations
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Every ingested call ranked best-to-worst by the AI Sales Manager, with a pointer on exactly what went wrong.
          </p>
        </div>

        <div className="text-xs text-slate-400 font-mono">
          Total Calls: <span className="font-bold text-white">{rankedCalls.length}</span>
        </div>
      </div>

      <ReanalyzeCallsBar
        calls={rankedCalls.map((call) => ({
          id: call.id,
          usedLlm: usedLlmReview(call.evaluation),
        }))}
        hasApiKey={ai.hasKey}
        providerName={getProvider(ai.providerId).name}
      />

      {/* Ranked Calls Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/90 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="table-header">
              <tr>
                <th className="px-6 py-3.5">Rank</th>
                <th className="px-6 py-3.5">Rep & Prospect</th>
                <th className="px-6 py-3.5">Stage</th>
                <th className="px-6 py-3.5">Sandler Badges</th>
                <th className="px-6 py-3.5">Script Adherence</th>
                <th className="px-6 py-3.5">Score</th>
                <th className="px-6 py-3.5">What Went Wrong</th>
                <th className="px-6 py-3.5">Outcome</th>
                <th className="px-6 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {rankedCalls.map((call) => {
                const ev = call.evaluation;
                const isBooked = call.coreOutcome.toLowerCase().includes("booked");
                const issue = getPrimaryIssue(call);
                const isTopThree = call.rank <= 3;

                return (
                  <tr key={call.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold font-mono border ${
                          call.rank === 1
                            ? "bg-amber-400/20 text-amber-300 border-amber-400/40"
                            : isTopThree
                            ? "bg-slate-700/50 text-slate-200 border-slate-600"
                            : "bg-slate-800 text-slate-400 border-slate-700"
                        }`}
                      >
                        {call.rank === 1 ? <Trophy className="h-4 w-4" /> : call.rank}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <div className="font-semibold text-white">{call.repName}</div>
                      <div className="text-xs text-slate-400">
                        {call.prospectCompany} • {call.prospectName}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span className="rounded bg-slate-800 px-2.5 py-0.5 text-xs text-slate-300 border border-slate-700">
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
                            P: {ev.sandlerBreakdown.pain.status[0]}
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
                            B: {ev.sandlerBreakdown.budget.status[0]}
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
                            D: {ev.sandlerBreakdown.decision.status[0]}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500 font-mono">Analyzing...</span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      {ev ? (
                        <span className={`font-mono text-xs font-bold ${
                          ev.sandlerBreakdown.scriptAdherence.score >= 8
                            ? "text-emerald-400"
                            : ev.sandlerBreakdown.scriptAdherence.score >= 6
                            ? "text-amber-400"
                            : "text-rose-400"
                        }`}>
                          {ev.sandlerBreakdown.scriptAdherence.score}/10
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>

                    <td className="px-6 py-4">
                      {ev ? (
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                call.score >= 75
                                  ? "bg-emerald-500"
                                  : call.score >= 45
                                  ? "bg-amber-500"
                                  : "bg-rose-500"
                              }`}
                              style={{ width: `${call.score}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs font-bold text-slate-200">{call.score}</span>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>

                    <td className="px-6 py-4 max-w-[16rem]">
                      <span
                        className={`inline-flex items-start gap-1.5 text-xs font-medium ${
                          issue.severity === "critical"
                            ? "text-rose-300"
                            : issue.severity === "warn"
                            ? "text-amber-300"
                            : "text-emerald-300"
                        }`}
                      >
                        {issue.severity === "good" ? (
                          <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        ) : (
                          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        )}
                        {issue.text}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${
                        isBooked
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-slate-800 text-slate-400 border border-slate-700"
                      }`}>
                        {call.coreOutcome}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center justify-end gap-2">
                        <ReanalyzeButton
                          callId={call.id}
                          variant="compact"
                          hasApiKey={ai.hasKey}
                          usedLlm={usedLlmReview(ev)}
                        />
                        <Link
                          href={`/calls/${call.id}`}
                          className="rounded bg-blue-600/10 border border-blue-500/30 px-3 py-1.5 text-xs font-semibold text-blue-400 hover:bg-blue-600 hover:text-white transition inline-flex items-center gap-1"
                        >
                          Review <ArrowUpRight className="h-3 w-3" />
                        </Link>
                      </div>
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

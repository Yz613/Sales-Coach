import Link from "next/link";
import { getAllCalls } from "@/lib/db/service";
import { rankCalls, getPrimaryIssue } from "@/lib/callInsights";
import { ArrowUpRight, Trophy, AlertTriangle, CheckCircle2, Headphones } from "lucide-react";
import CallBankActions from "@/components/CallBankActions";
import ReanalyzeCallsBar from "@/components/ReanalyzeCallsBar";
import ReanalyzeButton from "@/components/ReanalyzeButton";
import { resolveAiSettings } from "@/lib/ai/settings";
import { getProvider } from "@/lib/ai/providers";
import { usedLlmReview } from "@/lib/evaluations";
import { outcomeBadgeClass } from "@/lib/coreOutcome";
import { callPartySubtitle } from "@/lib/callLabel";

export const dynamic = "force-dynamic";

export default async function CallBankPage() {
  const rankedCalls = rankCalls(await getAllCalls());
  const ai = await resolveAiSettings();

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="rounded-full bg-blue-500/10 px-3 py-0.5 text-xs font-semibold uppercase tracking-wider text-blue-400 border border-blue-500/20">
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

        <CallBankActions totalCalls={rankedCalls.length} />
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
      <div className="rounded-2xl glass-card overflow-hidden shadow-2xl border border-white/[0.08]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="table-header">
              <tr>
                <th className="px-4 py-3.5 text-center w-12 font-semibold">Rank</th>
                <th className="px-4 py-3.5 min-w-[150px] font-semibold">Rep & Prospect</th>
                <th className="px-4 py-3.5 whitespace-nowrap font-semibold">Stage</th>
                <th className="px-4 py-3.5 whitespace-nowrap font-semibold">Sandler Badges</th>
                <th className="px-4 py-3.5 whitespace-nowrap text-center font-semibold">Script</th>
                <th className="px-4 py-3.5 whitespace-nowrap font-semibold">Score</th>
                <th className="px-4 py-3.5 min-w-[200px] font-semibold">What Went Wrong</th>
                <th className="px-4 py-3.5 whitespace-nowrap font-semibold">Outcome</th>
                <th className="px-4 py-3.5 text-right whitespace-nowrap font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {rankedCalls.map((call) => {
                const ev = call.evaluation;
                const issue = getPrimaryIssue(call);
                const isTopThree = call.rank <= 3;

                return (
                  <tr key={call.id} className="hover:bg-white/[0.02] transition">
                    <td className="px-4 py-3.5 text-center">
                      <span
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold font-mono border ${
                          call.rank === 1
                            ? "bg-amber-400/20 text-amber-300 border-amber-400/40 shadow-xs shadow-amber-400/20"
                            : isTopThree
                            ? "bg-white/[0.08] text-slate-200 border-white/20"
                            : "bg-white/[0.04] text-slate-400 border-white/[0.08]"
                        }`}
                      >
                        {call.rank === 1 ? <Trophy className="h-3.5 w-3.5" /> : call.rank}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 min-w-[150px]">
                      <div className="font-semibold text-white truncate max-w-[200px] inline-flex items-center gap-1.5">
                        {call.audioUrl ? <Headphones className="h-3.5 w-3.5 text-sky-400 shrink-0" /> : null}
                        <span className="truncate">{call.repName}</span>
                      </div>
                      <div className="text-xs text-slate-400 truncate max-w-[200px]">
                        {callPartySubtitle(call)}
                      </div>
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="rounded-full bg-white/[0.05] px-2.5 py-0.5 text-xs text-slate-300 border border-white/[0.08]">
                        {call.callStage}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {ev ? (
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          <span
                            title={`Pain: ${ev.sandlerBreakdown.pain.status}`}
                            className={`px-2 py-0.5 rounded-md font-bold ${
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
                            className={`px-2 py-0.5 rounded-md font-bold ${
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
                            className={`px-2 py-0.5 rounded-md font-bold ${
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

                    <td className="px-4 py-3.5 whitespace-nowrap text-center">
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

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {ev ? (
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-14 rounded-full bg-slate-950/60 overflow-hidden border border-white/[0.06]">
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

                    <td className="px-4 py-3.5 min-w-[200px] max-w-[22rem] lg:max-w-md">
                      <span
                        className={`inline-flex items-start gap-1.5 text-xs font-medium leading-relaxed ${
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
                        <span>{issue.text}</span>
                      </span>
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${outcomeBadgeClass(call.coreOutcome)}`}>
                        {call.coreOutcome}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-2">
                        <ReanalyzeButton
                          callId={call.id}
                          variant="compact"
                          hasApiKey={ai.hasKey}
                          usedLlm={usedLlmReview(ev)}
                        />
                        <Link
                          href={`/calls/${call.id}`}
                          className="rounded-xl bg-blue-600/10 border border-blue-500/30 px-3 py-1.5 text-xs font-semibold text-blue-400 hover:bg-blue-600 hover:text-white transition inline-flex items-center gap-1 backdrop-blur-md"
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

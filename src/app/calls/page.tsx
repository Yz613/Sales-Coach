import { withWorkspacePage } from "@/lib/workspace";
import Link from "next/link";
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
import { getVisibleCalls } from "@/lib/viewer-calls";
import { getSalesMethodId, getScoreWeights } from "@/lib/db/service";
import { methodById } from "@/lib/salesMethods";
import { hasConnectedIntegrations } from "@/lib/revenue/connections";
import LiveFeedRefresh from "@/components/revenue/LiveFeedRefresh";

export const dynamic = "force-dynamic";

async function CallBankPage() {
  const { auth, calls } = await getVisibleCalls();
  const methodology = methodById(await getSalesMethodId());
  const rankedCalls = rankCalls(calls, { weights: await getScoreWeights(methodology), method: methodology });
  const ai = await resolveAiSettings();

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-black/[0.08] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="rounded-full bg-blue-500/10 px-3 py-0.5 text-xs font-semibold uppercase tracking-wider text-[#007AFF] border border-blue-500/20">
              Call Bank
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">
            {auth.canViewAllCalls ? "Ranked Calls & Evaluations" : "Your Calls"}
          </h1>
          <p className="text-sm text-[#6e6e73] mt-1">
            {auth.canViewAllCalls
              ? "Every ingested call ranked best-to-worst by the AI Sales Manager, with a pointer on exactly what went wrong."
              : "Only your calls. Teammates cannot see these, and you cannot see theirs."}
          </p>
          <LiveFeedRefresh enabled={await hasConnectedIntegrations("calls")} />
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
      <div className="rounded-2xl glass-card overflow-hidden shadow-2xl border border-black/[0.08]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-[#3a3a3c]">
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
            <tbody className="divide-y divide-black/[0.06]">
              {rankedCalls.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-sm text-[#6e6e73]">
                    {auth.canViewAllCalls
                      ? "No calls have been uploaded yet."
                      : "You have not uploaded any calls yet. Use Upload Calls to add your own."}
                  </td>
                </tr>
              )}
              {rankedCalls.map((call) => {
                const ev = call.evaluation;
                const issue = getPrimaryIssue(call);
                const isTopThree = call.rank <= 3;

                return (
                  <tr key={call.id} className="hover:bg-black/[0.03] transition">
                    <td className="px-4 py-3.5 text-center">
                      <span
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold font-mono border ${
                          call.rank === 1
                            ? "bg-[#FF9500]/15 text-[#C45500] border-[#FF9500]/30"
                            : isTopThree
                            ? "bg-black/[0.06] text-[#1d1d1f] border-black/10"
                            : "bg-black/[0.04] text-[#6e6e73] border-black/[0.08]"
                        }`}
                      >
                        {call.rank === 1 ? <Trophy className="h-3.5 w-3.5" /> : call.rank}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 min-w-[150px]">
                      <div className="font-semibold text-[#1d1d1f] truncate max-w-[200px] inline-flex items-center gap-1.5">
                        {call.audioUrl ? <Headphones className="h-3.5 w-3.5 text-[#007AFF] shrink-0" /> : null}
                        <span className="truncate">{call.repName}</span>
                      </div>
                      <div className="text-xs text-[#6e6e73] truncate max-w-[200px]">
                        {callPartySubtitle(call)}
                      </div>
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="rounded-full bg-black/[0.04] px-2.5 py-0.5 text-xs text-[#3a3a3c] border border-black/[0.08]">
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
                                ? "bg-emerald-500/20 text-[#248A3D]"
                                : ev.sandlerBreakdown.pain.status === "Incomplete"
                                ? "bg-amber-500/20 text-[#C45500]"
                                : "bg-rose-500/20 text-[#FF3B30]"
                            }`}
                          >
                            P: {ev.sandlerBreakdown.pain.status[0]}
                          </span>
                          <span
                            title={`Budget: ${ev.sandlerBreakdown.budget.status}`}
                            className={`px-2 py-0.5 rounded-md font-bold ${
                              ev.sandlerBreakdown.budget.status === "Pass"
                                ? "bg-emerald-500/20 text-[#248A3D]"
                                : ev.sandlerBreakdown.budget.status === "Incomplete"
                                ? "bg-amber-500/20 text-[#C45500]"
                                : "bg-rose-500/20 text-[#FF3B30]"
                            }`}
                          >
                            B: {ev.sandlerBreakdown.budget.status[0]}
                          </span>
                          <span
                            title={`Decision: ${ev.sandlerBreakdown.decision.status}`}
                            className={`px-2 py-0.5 rounded-md font-bold ${
                              ev.sandlerBreakdown.decision.status === "Pass"
                                ? "bg-emerald-500/20 text-[#248A3D]"
                                : ev.sandlerBreakdown.decision.status === "Incomplete"
                                ? "bg-amber-500/20 text-[#C45500]"
                                : "bg-rose-500/20 text-[#FF3B30]"
                            }`}
                          >
                            D: {ev.sandlerBreakdown.decision.status[0]}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-[#86868b] font-mono">Analyzing...</span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap text-center">
                      {ev ? (
                        <span className={`font-mono text-xs font-bold ${
                          ev.sandlerBreakdown.scriptAdherence.score >= 8
                            ? "text-[#248A3D]"
                            : ev.sandlerBreakdown.scriptAdherence.score >= 6
                            ? "text-[#C45500]"
                            : "text-[#FF3B30]"
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
                          <div className="h-2 w-14 rounded-full bg-[#F2F2F7] overflow-hidden border border-black/[0.06]">
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
                          <span className="font-mono text-xs font-bold text-[#1d1d1f]">{call.score}</span>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>

                    <td className="px-4 py-3.5 min-w-[200px] max-w-[22rem] lg:max-w-md">
                      <span
                        className={`inline-flex items-start gap-1.5 text-xs font-medium leading-relaxed ${
                          issue.severity === "critical"
                            ? "text-[#D70015]"
                            : issue.severity === "warn"
                            ? "text-[#C45500]"
                            : "text-[#248A3D]"
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
                          className="rounded-xl bg-blue-600/10 border border-blue-500/30 px-3 py-1.5 text-xs font-semibold text-[#007AFF] hover:bg-[#0071E3] hover:text-white transition inline-flex items-center gap-1"
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

export default withWorkspacePage(CallBankPage, {});

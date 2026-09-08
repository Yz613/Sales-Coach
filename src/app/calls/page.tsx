import Link from "next/link";
import { getAllCalls } from "@/lib/db/service";
import { formatDate, formatDuration } from "@/lib/utils";
import { PhoneCall, Filter, Search, ArrowUpRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CallBankPage() {
  const calls = await getAllCalls();

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
            All Ingested Calls & Evaluations
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Searchable repository of recorded and uploaded calls reviewed by the AI Sales Manager.
          </p>
        </div>

        <div className="text-xs text-slate-400 font-mono">
          Total Calls: <span className="font-bold text-white">{calls.length}</span>
        </div>
      </div>

      {/* Calls Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/90 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="table-header">
              <tr>
                <th className="px-6 py-3.5">Rep & Prospect</th>
                <th className="px-6 py-3.5">Stage</th>
                <th className="px-6 py-3.5">Sandler Badges</th>
                <th className="px-6 py-3.5">Script Adherence</th>
                <th className="px-6 py-3.5">Outcome</th>
                <th className="px-6 py-3.5">Date</th>
                <th className="px-6 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {calls.map((call) => {
                const ev = call.evaluation;
                const isBooked = call.coreOutcome.toLowerCase().includes("booked");

                return (
                  <tr key={call.id} className="hover:bg-slate-800/30 transition">
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
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${
                        isBooked
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-slate-800 text-slate-400 border border-slate-700"
                      }`}>
                        {call.coreOutcome}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-xs text-slate-400 font-mono">
                      {formatDate(call.createdAt)}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/calls/${call.id}`}
                        className="rounded bg-blue-600/10 border border-blue-500/30 px-3 py-1.5 text-xs font-semibold text-blue-400 hover:bg-blue-600 hover:text-white transition inline-flex items-center gap-1"
                      >
                        Review <ArrowUpRight className="h-3 w-3" />
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

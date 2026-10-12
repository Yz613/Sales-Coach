"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Trophy,
  ArrowUpRight,
  LayoutGrid,
  List,
  Search,
  CheckCircle2,
  MinusCircle,
  XCircle,
} from "lucide-react";
import type { DemoCall } from "@/lib/demo/workspace";
import { demoOverallScore } from "@/lib/demo/workspace";

export default function DemoCallsView({ calls }: { calls: readonly DemoCall[] }) {
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [stageFilter, setStageFilter] = useState("all");
  const [search, setSearch] = useState("");

  const stages = ["all", "Cold call", "Discovery", "Demo", "Negotiation"];

  const filteredCalls = calls
    .filter((call) => (stageFilter === "all" ? true : call.stage === stageFilter))
    .filter((call) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        call.company.toLowerCase().includes(q) ||
        call.repName.toLowerCase().includes(q) ||
        call.prospectName.toLowerCase().includes(q) ||
        call.summary.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => a.rank - b.rank);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#1d1d1f]">Ranked Calls & Evaluations</h2>
          <p className="text-xs text-[#6e6e73] mt-0.5">
            Every sample call evaluated against stage rubrics, ranked best-to-worst with pinpointed coaching issues.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-full bg-[#E5E5EA] p-0.5 border border-black/[0.06]">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
                viewMode === "table" ? "bg-white text-[#1d1d1f] shadow-xs" : "text-[#6e6e73]"
              }`}
            >
              <List className="h-3.5 w-3.5" /> Table
            </button>
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
                viewMode === "cards" ? "bg-white text-[#1d1d1f] shadow-xs" : "text-[#6e6e73]"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Cards
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#86868b]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by company, rep, or prospect..."
            className="w-full rounded-xl bg-white border border-black/[0.08] pl-9 pr-4 py-2 text-xs text-[#1d1d1f] placeholder:text-[#86868b] focus:border-blue-500 focus:outline-none shadow-xs"
          />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
          {stages.map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStageFilter(st)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition ${
                stageFilter === st
                  ? "bg-[#007AFF] text-white shadow-xs"
                  : "bg-white text-[#3a3a3c] border border-black/[0.08] hover:bg-black/[0.03]"
              }`}
            >
              {st === "all" ? "All Stages" : st}
            </button>
          ))}
        </div>
      </div>

      {viewMode === "table" ? (
        <div className="rounded-2xl glass-card overflow-hidden border border-black/[0.08] shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#3a3a3c]">
              <thead className="table-header border-b border-black/[0.08] bg-black/[0.02]">
                <tr>
                  <th className="px-4 py-3 text-center w-12 font-semibold">Rank</th>
                  <th className="px-4 py-3 min-w-[170px] font-semibold">Rep & Prospect</th>
                  <th className="px-4 py-3 whitespace-nowrap font-semibold">Stage</th>
                  <th className="px-4 py-3 whitespace-nowrap font-semibold">Sandler Pillars</th>
                  <th className="px-4 py-3 text-center font-semibold">Script</th>
                  <th className="px-4 py-3 text-center font-semibold">Score</th>
                  <th className="px-4 py-3 min-w-[220px] font-semibold">What Went Wrong</th>
                  <th className="px-4 py-3 whitespace-nowrap font-semibold">Outcome</th>
                  <th className="px-4 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06]">
                {filteredCalls.map((call) => {
                  const isFirst = call.rank === 1;
                  const painStatus = call.sandlerBreakdown.pain.status;
                  const budgetStatus = call.sandlerBreakdown.budget.status;
                  const decisionStatus = call.sandlerBreakdown.decision.status;

                  return (
                    <tr key={call.id} className="hover:bg-black/[0.02] transition">
                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold font-mono border ${
                            isFirst
                              ? "bg-amber-500/20 text-[#C45500] border-amber-500/30"
                              : "bg-black/[0.04] text-[#1d1d1f] border-black/[0.08]"
                          }`}
                        >
                          {isFirst ? <Trophy className="h-3.5 w-3.5 text-[#FF9500]" /> : `#${call.rank}`}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <Link href={`/demo/${call.id}`} className="font-semibold text-[#1d1d1f] hover:text-[#007AFF]">
                          {call.company}
                        </Link>
                        <div className="text-[11px] text-[#6e6e73] mt-0.5">
                          {call.repName} with {call.prospectName}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#007AFF] border border-blue-500/20">
                          {call.stage}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <span
                            title={`Pain: ${painStatus}`}
                            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              painStatus === "Pass"
                                ? "bg-emerald-500/10 text-[#248A3D]"
                                : painStatus === "Incomplete"
                                ? "bg-amber-500/10 text-[#C45500]"
                                : "bg-rose-500/10 text-[#FF3B30]"
                            }`}
                          >
                            P
                          </span>
                          <span
                            title={`Budget: ${budgetStatus}`}
                            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              budgetStatus === "Pass"
                                ? "bg-emerald-500/10 text-[#248A3D]"
                                : budgetStatus === "Incomplete"
                                ? "bg-amber-500/10 text-[#C45500]"
                                : "bg-rose-500/10 text-[#FF3B30]"
                            }`}
                          >
                            B
                          </span>
                          <span
                            title={`Decision: ${decisionStatus}`}
                            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              decisionStatus === "Pass"
                                ? "bg-emerald-500/10 text-[#248A3D]"
                                : decisionStatus === "Incomplete"
                                ? "bg-amber-500/10 text-[#C45500]"
                                : "bg-rose-500/10 text-[#FF3B30]"
                            }`}
                          >
                            D
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center font-mono font-semibold">
                        {call.sandlerBreakdown.scriptAdherence.score}/10
                      </td>
                      <td className="px-4 py-3.5 text-center font-mono font-bold text-sm">
                        <span
                          className={
                            demoOverallScore(call) >= 8
                              ? "text-[#248A3D]"
                              : demoOverallScore(call) >= 6
                              ? "text-[#C45500]"
                              : "text-[#FF3B30]"
                          }
                        >
                          {demoOverallScore(call).toFixed(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="line-clamp-2 text-xs leading-relaxed text-[#3a3a3c]">{call.whatWentWrong}</p>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="rounded-full bg-black/[0.05] px-2.5 py-0.5 text-[11px] font-semibold text-[#1d1d1f]">
                          {call.outcome}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <Link
                          href={`/demo/${call.id}`}
                          className="inline-flex items-center gap-1 rounded-lg bg-black/[0.04] px-2.5 py-1 text-xs font-semibold text-[#007AFF] hover:bg-[#007AFF] hover:text-white transition"
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
      ) : (
        <ul className="space-y-3">
          {filteredCalls.map((call) => (
            <li key={call.id}>
              <Link href={`/demo/${call.id}`} className="block rounded-2xl glass-card p-5 hover:bg-white transition border border-black/[0.06]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[#007AFF]/10 text-xs font-bold text-[#007AFF] font-mono shrink-0">
                      #{call.rank}
                    </span>
                    <div>
                      <p className="text-base font-semibold">{call.company}</p>
                      <p className="mt-0.5 text-xs text-[#6e6e73]">
                        {call.repName} · {call.prospectName}, {call.prospectTitle}
                      </p>
                    </div>
                  </div>
                  <p className="font-mono text-base font-bold text-[#1d1d1f]">
                    {demoOverallScore(call).toFixed(1)} <span className="text-xs text-[#86868b] font-normal">/ 10</span>
                  </p>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-[#3a3a3c]">{call.summary}</p>
                <div className="mt-3 flex flex-wrap gap-1.5 items-center">
                  <span className="rounded-full bg-black/[0.04] px-2.5 py-0.5 text-[11px] font-semibold text-[#3a3a3c]">
                    {call.stage}
                  </span>
                  <span className="rounded-full bg-black/[0.04] px-2.5 py-0.5 text-[11px] font-semibold text-[#3a3a3c]">
                    {call.outcome}
                  </span>
                  {call.trackers.map((tracker) => (
                    <span key={tracker.id} className="rounded-full bg-[#007AFF]/10 px-2 py-0.5 text-[11px] font-semibold text-[#007AFF]">
                      {tracker.name}
                    </span>
                  ))}
                  <span className="ml-auto text-xs font-semibold text-[#007AFF] flex items-center gap-1">
                    Open full review <ArrowUpRight className="h-3 w-3" />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

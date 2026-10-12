"use client";

import { useState } from "react";
import { BarChart3, TrendingUp, CheckCircle2, ArrowUpRight } from "lucide-react";
import { DEMO_FORECAST } from "@/lib/demo/workspace";

export default function DemoForecastView() {
  const [period, setPeriod] = useState("Q3 2026");
  const { targetAmount, closedAmount, commitAmount, bestCaseAmount, pipelineAmount, deals } = DEMO_FORECAST;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#1d1d1f]">Revenue Forecast Workspace</h2>
          <p className="text-xs text-[#6e6e73] mt-0.5">
            Manager-entered forecast rollups, deal category weighting, and quota attainment tracking.
          </p>
        </div>

        <div className="flex items-center gap-1.5 rounded-full bg-[#E5E5EA] p-1 border border-black/[0.06]">
          {["Q3 2026", "Q4 2026"].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded-full px-3.5 py-1 text-xs font-semibold transition ${
                period === p ? "bg-white text-[#1d1d1f] shadow-xs" : "text-[#6e6e73]"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Forecast Category Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl glass-card p-5 space-y-1.5 border border-black/[0.06]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#248A3D]">Closed Won</span>
          <div className="font-mono text-2xl font-bold text-[#1d1d1f]">${(closedAmount).toLocaleString()}</div>
          <p className="text-[11px] text-[#86868b]">Executed contracts and collected revenue.</p>
        </div>

        <div className="rounded-2xl glass-card p-5 space-y-1.5 border border-black/[0.06]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#007AFF]">Commit</span>
          <div className="font-mono text-2xl font-bold text-[#007AFF]">${(commitAmount).toLocaleString()}</div>
          <p className="text-[11px] text-[#86868b]">Verbal agreements & procurement approval in flight.</p>
        </div>

        <div className="rounded-2xl glass-card p-5 space-y-1.5 border border-black/[0.06]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF9500]">Best Case</span>
          <div className="font-mono text-2xl font-bold text-[#1d1d1f]">${(bestCaseAmount).toLocaleString()}</div>
          <p className="text-[11px] text-[#86868b]">High-probability upside opportunities.</p>
        </div>

        <div className="rounded-2xl glass-card p-5 space-y-1.5 border border-black/[0.06]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#6e6e73]">Open Pipeline</span>
          <div className="font-mono text-2xl font-bold text-[#1d1d1f]">${(pipelineAmount).toLocaleString()}</div>
          <p className="text-[11px] text-[#86868b]">Total active qualifying conversations.</p>
        </div>
      </div>

      {/* Target Attainment Bar */}
      <div className="rounded-2xl glass-card p-6 space-y-3 border border-black/[0.06]">
        <div className="flex items-center justify-between text-xs">
          <div>
            <span className="font-bold text-[#1d1d1f]">Target: ${(targetAmount).toLocaleString()}</span>
            <span className="text-[#6e6e73] ml-2">
              (Closed + Commit: ${(closedAmount + commitAmount).toLocaleString()})
            </span>
          </div>
          <span className="font-mono font-bold text-[#248A3D]">
            {Math.round(((closedAmount + commitAmount) / targetAmount) * 100)}% Coverage
          </span>
        </div>
        <div className="h-3 w-full rounded-full bg-[#E5E5EA] overflow-hidden flex">
          <div
            className="h-full bg-[#248A3D]"
            style={{ width: `${(closedAmount / targetAmount) * 100}%` }}
            title={`Closed: $${closedAmount}`}
          />
          <div
            className="h-full bg-[#007AFF]"
            style={{ width: `${(commitAmount / targetAmount) * 100}%` }}
            title={`Commit: $${commitAmount}`}
          />
        </div>
      </div>

      {/* Deals Table in Forecast */}
      <div className="rounded-2xl glass-card overflow-hidden border border-black/[0.08]">
        <div className="border-b border-black/[0.08] px-6 py-3.5 bg-black/[0.02]">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#1d1d1f]">
            Included Forecast Deals ({period})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#3a3a3c]">
            <thead className="table-header border-b border-black/[0.06]">
              <tr>
                <th className="px-5 py-3 font-semibold">Deal / Company</th>
                <th className="px-5 py-3 font-semibold">Owner</th>
                <th className="px-5 py-3 font-semibold">Category</th>
                <th className="px-5 py-3 font-semibold">Stage</th>
                <th className="px-5 py-3 text-right font-semibold">Forecast Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.06]">
              {deals.map((d, idx) => (
                <tr key={idx} className="hover:bg-black/[0.02] transition">
                  <td className="px-5 py-3.5 font-semibold text-[#1d1d1f]">{d.name}</td>
                  <td className="px-5 py-3.5 text-[#6e6e73]">{d.owner}</td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        d.category === "Closed"
                          ? "bg-emerald-500/10 text-[#248A3D]"
                          : d.category === "Commit"
                          ? "bg-blue-500/10 text-[#007AFF]"
                          : d.category === "Best Case"
                          ? "bg-amber-500/10 text-[#C45500]"
                          : "bg-black/[0.05] text-[#3a3a3c]"
                      }`}
                    >
                      {d.category}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-[#6e6e73]">{d.stage}</td>
                  <td className="px-5 py-3.5 text-right font-mono font-bold text-[#1d1d1f]">
                    ${(d.value).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { Briefcase, ArrowUpRight, DollarSign, Calendar } from "lucide-react";
import { DEMO_DEALS } from "@/lib/demo/workspace";

const PIPELINE_STAGES = [
  "Discovery",
  "Demo Scheduled",
  "Proposal / Evaluation",
  "Negotiation",
  "Closed Won",
];

export default function DemoDealsView() {
  const totalValue = DEMO_DEALS.reduce((acc, d) => acc + d.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#1d1d1f]">CRM Deal Pipeline</h2>
          <p className="text-xs text-[#6e6e73] mt-0.5">
            Active opportunities with conversation intelligence, probability weighting, and next steps.
          </p>
        </div>
        <div className="rounded-full bg-blue-500/10 px-4 py-1.5 text-xs font-semibold text-[#007AFF] border border-blue-500/20 font-mono">
          Total Pipeline: ${(totalValue).toLocaleString()}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 overflow-x-auto pb-2">
        {PIPELINE_STAGES.map((stage) => {
          const dealsInStage = DEMO_DEALS.filter((d) => d.stage === stage);
          const stageValue = dealsInStage.reduce((acc, d) => acc + d.amount, 0);

          return (
            <div
              key={stage}
              className="rounded-2xl glass-card p-4 space-y-3 border border-black/[0.08] min-w-[220px] flex flex-col"
            >
              <div className="flex items-center justify-between border-b border-black/[0.06] pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#1d1d1f] truncate">
                  {stage}
                </span>
                <span className="rounded-full bg-black/[0.05] px-2 py-0.5 font-mono text-[10px] font-semibold text-[#6e6e73]">
                  {dealsInStage.length}
                </span>
              </div>
              <div className="text-[11px] font-mono text-[#86868b]">
                ${(stageValue).toLocaleString()}
              </div>

              <div className="space-y-3 flex-1">
                {dealsInStage.map((deal) => (
                  <div
                    key={deal.id}
                    className="rounded-xl border border-black/[0.08] bg-white p-3.5 space-y-2 hover:shadow-sm transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-bold text-[#1d1d1f] line-clamp-1">{deal.company}</h4>
                      <span className="font-mono text-xs font-bold text-[#248A3D] shrink-0">
                        ${(deal.amount).toLocaleString()}
                      </span>
                    </div>

                    <p className="text-[11px] text-[#6e6e73] leading-snug">{deal.summary}</p>

                    <div className="rounded-lg bg-[#F5F5F7] p-2 text-[10px] space-y-1 text-[#3a3a3c]">
                      <div className="flex items-center gap-1 font-semibold text-[#007AFF]">
                        <Calendar className="h-3 w-3" /> Next step:
                      </div>
                      <p className="leading-tight text-[#6e6e73]">{deal.nextStep}</p>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-black/[0.04] text-[10px]">
                      <span className="text-[#86868b]">{deal.repName}</span>
                      {deal.associatedCallId && (
                        <Link
                          href={`/demo/${deal.associatedCallId}`}
                          className="text-[#007AFF] hover:underline font-semibold flex items-center gap-0.5"
                        >
                          Review call <ArrowUpRight className="h-2.5 w-2.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                ))}

                {dealsInStage.length === 0 && (
                  <div className="py-8 text-center text-xs text-[#86868b] italic">
                    No open deals in {stage}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

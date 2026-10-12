"use client";

import { Plug, CheckCircle2, ArrowUpRight } from "lucide-react";
import { DEMO_INTEGRATIONS } from "@/lib/demo/workspace";

export default function DemoIntegrationsView() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-[#1d1d1f]">Connected Integrations Hub</h2>
        <p className="text-xs text-[#6e6e73] mt-0.5">
          Connect your video meeting tools, CRMs, task boards, and notifications for automated call scoring.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {DEMO_INTEGRATIONS.map((tool) => {
          const isConnected = tool.status === "Connected";
          return (
            <div
              key={tool.name}
              className="rounded-2xl glass-card p-5 space-y-3 border border-black/[0.08] hover:border-black/[0.15] transition"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#1d1d1f]">{tool.name}</h3>
                  <span className="text-[10px] text-[#86868b] uppercase tracking-wider">{tool.category}</span>
                </div>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                    isConnected
                      ? "bg-emerald-500/10 text-[#248A3D] border-emerald-500/20"
                      : "bg-blue-500/10 text-[#007AFF] border-blue-500/20"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${isConnected ? "bg-[#248A3D]" : "bg-[#007AFF]"}`}
                  />
                  {tool.status}
                </span>
              </div>

              <p className="text-xs text-[#6e6e73] leading-relaxed">{tool.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

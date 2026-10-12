"use client";

import { useState } from "react";
import { Users, CheckCircle2, XCircle, ArrowUpRight, Flame, ShieldCheck, Clock, X } from "lucide-react";
import { DEMO_REPS } from "@/lib/demo/workspace";

export default function DemoRepsView() {
  const [selectedRep, setSelectedRep] = useState<(typeof DEMO_REPS)[0] | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#1d1d1f]">Sales Team Scorecards & Progression</h2>
          <p className="text-xs text-[#6e6e73] mt-0.5">
            Individual rep trajectories, pass rates, and manager 1:1 talk tracks synthesized from calls.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {DEMO_REPS.map((rep) => {
          const isProgressing = rep.trajectory === "progressing";
          const isStagnant = rep.trajectory === "stagnant";

          return (
            <div key={rep.id} className="rounded-2xl glass-card p-6 space-y-4 border border-black/[0.08]">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-bold text-[#1d1d1f]">{rep.name}</h3>
                  <p className="text-xs text-[#6e6e73]">{rep.role} · {rep.email}</p>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-semibold border ${
                    isProgressing
                      ? "bg-emerald-500/10 text-[#248A3D] border-emerald-500/20"
                      : isStagnant
                      ? "bg-amber-500/10 text-[#C45500] border-amber-500/20"
                      : "bg-rose-500/10 text-[#D70015] border-rose-500/20"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isProgressing ? "bg-[#248A3D]" : isStagnant ? "bg-[#C45500]" : "bg-[#D70015]"
                    }`}
                  />
                  {rep.trajectory.charAt(0).toUpperCase() + rep.trajectory.slice(1)}
                </span>
              </div>

              <div className="rounded-xl glass-inset p-3.5 text-xs text-[#3a3a3c] leading-relaxed border border-black/[0.06]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#007AFF] block mb-1">
                  Manager's Current Assessment:
                </span>
                "{rep.trajectoryReason}"
              </div>

              <div className="grid grid-cols-4 gap-2 text-center font-mono">
                <div className="rounded-xl glass-inset p-2.5 border border-black/[0.06]">
                  <span className="text-[10px] uppercase font-semibold text-[#86868b] block font-sans">Calls</span>
                  <span className="text-base font-bold text-[#1d1d1f]">{rep.totalCalls}</span>
                </div>
                <div className="rounded-xl glass-inset p-2.5 border border-black/[0.06]">
                  <span className="text-[10px] uppercase font-semibold text-[#86868b] block font-sans">Pain</span>
                  <span className="text-base font-bold text-[#007AFF]">{rep.painPassRate}%</span>
                </div>
                <div className="rounded-xl glass-inset p-2.5 border border-black/[0.06]">
                  <span className="text-[10px] uppercase font-semibold text-[#86868b] block font-sans">Budget</span>
                  <span className="text-base font-bold text-[#248A3D]">{rep.budgetPassRate}%</span>
                </div>
                <div className="rounded-xl glass-inset p-2.5 border border-black/[0.06]">
                  <span className="text-[10px] uppercase font-semibold text-[#86868b] block font-sans">Script</span>
                  <span className="text-base font-bold text-[#C45500]">{rep.avgScriptScore}</span>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedRep(rep)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-black/[0.1] bg-black/[0.04] hover:bg-black/[0.08] px-4 py-2 text-xs font-semibold text-[#1d1d1f] transition"
                >
                  Open 1:1 talk track & coaching history <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 1:1 Talk Track Modal */}
      {selectedRep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="rounded-2xl bg-white border border-black/[0.1] shadow-2xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-black/[0.08] pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#007AFF]">Manager 1:1 Preparation</span>
                <h3 className="text-lg font-bold text-[#1d1d1f] mt-0.5">{selectedRep.name} — Coaching Talk Track</h3>
                <p className="text-xs text-[#6e6e73]">{selectedRep.role} · Trajectory: {selectedRep.trajectory}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRep(null)}
                className="rounded-full p-1.5 text-[#86868b] hover:bg-black/[0.05] hover:text-[#1d1d1f] transition"
                aria-label="Close talk track"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#248A3D] flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-[#248A3D]" /> Top Calling Wins to Praise
              </h4>
              <ul className="space-y-1.5 text-xs text-[#3a3a3c]">
                {selectedRep.talkTrack.wins.map((w, idx) => (
                  <li key={idx} className="flex items-start gap-2 bg-emerald-500/[0.04] p-2 rounded-lg border border-emerald-500/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#248A3D] mt-1.5 shrink-0" />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#FF3B30] flex items-center gap-1.5">
                <XCircle className="h-4 w-4 text-[#FF3B30]" /> Tactical Coaching Gaps to Address
              </h4>
              <ul className="space-y-1.5 text-xs text-[#3a3a3c]">
                {selectedRep.talkTrack.gaps.map((g, idx) => (
                  <li key={idx} className="flex items-start gap-2 bg-rose-500/[0.04] p-2 rounded-lg border border-rose-500/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#FF3B30] mt-1.5 shrink-0" />
                    <span>{g}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.05] p-4 space-y-1">
              <h5 className="text-[11px] font-bold uppercase tracking-wider text-[#007AFF]">Prescribed 1:1 Roleplay Drill</h5>
              <p className="text-xs text-[#1d1d1f] font-medium leading-relaxed">{selectedRep.talkTrack.drills}</p>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedRep(null)}
                className="rounded-xl bg-[#007AFF] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0071E3] transition"
              >
                Close Talk Track
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

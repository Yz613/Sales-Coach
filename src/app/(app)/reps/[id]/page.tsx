"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock, XCircle, ArrowUpRight, ShieldCheck, Flame, PhoneCall, Calendar, UserCheck, Settings2, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import PersonaModal from "@/components/PersonaModal";
import type { Rep, Call, RepPersona } from "@/types";

export default function RepDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [rep, setRep] = useState<Rep | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [snapshot, setSnapshot] = useState<any>(null);
  const [persona, setPersona] = useState<RepPersona | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPersonaOpen, setIsPersonaOpen] = useState(false);

  const fetchRepData = () => {
    fetch(`/api/reps/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.rep) {
          setRep(data.rep);
          setCalls(data.calls || []);
          setSnapshot(data.snapshot || null);
          setPersona(data.rep.persona || null);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchRepData();
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading Rep Performance Profile...
      </div>
    );
  }

  if (!rep) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Rep not found.</p>
        <Link href="/reps" className="text-blue-400 hover:underline text-sm mt-2 block">
          Return to Reps Directory
        </Link>
      </div>
    );
  }

  const isProgressing = rep.trajectory === "progressing";
  const isStagnant = rep.trajectory === "stagnant";
  const isRegressing = rep.trajectory === "regressing";

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/reps"
          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Reps Directory
        </Link>

        <button
          onClick={() => setIsPersonaOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/40 bg-blue-500/10 px-3.5 py-1.5 text-xs font-semibold text-blue-400 hover:bg-blue-500 hover:text-white transition"
        >
          <Settings2 className="h-3.5 w-3.5" /> Tune Rep Persona & Blindspots
        </button>
      </div>

      {/* Rep Header */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white tracking-tight">{rep.name}</h1>
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
            </div>
            <p className="text-sm text-slate-400 mt-1">
              {rep.role} • {rep.email}
            </p>
          </div>

          <div className="text-right font-mono">
            <span className="text-xs uppercase font-semibold text-slate-500 block">Avg Script Score</span>
            <span className="text-2xl font-bold text-white">{rep.avgScriptScore} / 10</span>
          </div>
        </div>

        {/* Manager Progression Take */}
        <div className="mt-5 rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 space-y-2">
          <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-wider">
            <ShieldCheck className="h-4 w-4" /> Manager Trajectory Assessment
          </div>
          <p className="text-sm text-slate-200 leading-relaxed font-medium">
            "{snapshot?.managerRationale || rep.trajectoryReason}"
          </p>
          {snapshot?.topActiveStruggle && (
            <div className="pt-1 text-xs">
              <span className="text-slate-400 uppercase font-semibold text-[10px] tracking-wider">Active Coaching Focus: </span>
              <span className="text-rose-400 font-semibold">{snapshot.topActiveStruggle}</span>
            </div>
          )}
        </div>

        {/* Persona Overview Card */}
        {persona && (
          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950 p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <UserCheck className="h-4 w-4 text-blue-400" /> Rep Persona Configuration
              </span>
              <span className="text-slate-400 font-mono text-[11px]">
                Tone: <strong className="text-white">{persona.coachingTone}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-500 uppercase font-semibold text-[10px] block mb-1">Known Blindspots</span>
                <div className="flex flex-wrap gap-1.5">
                  {persona.knownBlindspots.length > 0 ? (
                    persona.knownBlindspots.map((b, idx) => (
                      <span key={idx} className="rounded bg-rose-500/10 px-2 py-0.5 text-rose-300 text-[11px] border border-rose-500/20">
                        {b}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-500 italic">None tagged yet.</span>
                  )}
                </div>
              </div>

              <div>
                <span className="text-slate-500 uppercase font-semibold text-[10px] block mb-1">Manager 1-on-1 Notes</span>
                <p className="text-slate-300 font-mono text-[11px] leading-relaxed line-clamp-2">
                  {persona.managerNotes || "No private notes added yet."}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Rep Benchmarks */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 font-mono text-center">
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
            <span className="text-[10px] uppercase font-semibold text-slate-500 block">Total Calls</span>
            <span className="text-lg font-bold text-white">{rep.totalCalls}</span>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
            <span className="text-[10px] uppercase font-semibold text-slate-500 block">Pain Pass Rate</span>
            <span className="text-lg font-bold text-blue-400">{rep.painPassRate}%</span>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
            <span className="text-[10px] uppercase font-semibold text-slate-500 block">Budget Pass Rate</span>
            <span className="text-lg font-bold text-emerald-400">{rep.budgetPassRate}%</span>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
            <span className="text-[10px] uppercase font-semibold text-slate-500 block">Decision Pass Rate</span>
            <span className="text-lg font-bold text-amber-400">{rep.decisionPassRate}%</span>
          </div>
        </div>
      </div>

      {/* Historical Calls & Accountability */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/90 overflow-hidden space-y-0">
        <div className="border-b border-slate-800 px-6 py-4">
          <h2 className="text-base font-bold text-white tracking-tight">
            Call History & Coaching Fixes Timeline
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Review past calls to verify if {rep.name} implemented the top 2 fixes or repeated bad habits.
          </p>
        </div>

        <div className="divide-y divide-slate-800/60">
          {calls.map((c) => {
            const ev = c.evaluation;
            const isBooked = c.coreOutcome.toLowerCase().includes("booked");

            return (
              <div key={c.id} className="p-6 hover:bg-slate-800/30 transition space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300 font-mono border border-slate-700">
                        {c.callStage}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">
                        {formatDate(c.createdAt)}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-white">
                      {c.prospectCompany} <span className="text-xs font-normal text-slate-400">({c.prospectName})</span>
                    </h3>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ${
                      isBooked
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-slate-800 text-slate-400 border border-slate-700"
                    }`}>
                      {c.coreOutcome}
                    </span>

                    {ev && (
                      <span className={`font-mono text-xs font-bold px-2 py-1 rounded border ${
                        ev.sandlerBreakdown.scriptAdherence.score >= 8
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : ev.sandlerBreakdown.scriptAdherence.score >= 6
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                      }`}>
                        Score: {ev.sandlerBreakdown.scriptAdherence.score}/10
                      </span>
                    )}

                    <Link
                      href={`/calls/${c.id}`}
                      className="rounded bg-blue-600/10 border border-blue-500/30 px-3 py-1 text-xs font-semibold text-blue-400 hover:bg-blue-600 hover:text-white transition inline-flex items-center gap-1"
                    >
                      Review <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>

                {ev && (
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 space-y-3">
                    <p className="text-xs text-slate-300 italic">
                      "{ev.bottomLine}"
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 border-t border-slate-800/80">
                      <div className="text-xs">
                        <span className="text-[10px] uppercase font-bold text-blue-400 block mb-0.5">Assigned Fix #1:</span>
                        <span className="text-slate-200 font-medium">{ev.topFixes[0]?.title}</span>
                      </div>
                      <div className="text-xs">
                        <span className="text-[10px] uppercase font-bold text-blue-400 block mb-0.5">Assigned Fix #2:</span>
                        <span className="text-slate-200 font-medium">{ev.topFixes[1]?.title}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <PersonaModal
        isOpen={isPersonaOpen}
        onClose={() => setIsPersonaOpen(false)}
        repId={rep.id}
        repName={rep.name}
        onSaved={fetchRepData}
      />
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { getCallById, getAllCalls, getActiveScriptForStage } from "@/lib/db/service";
import { rankCalls, divergenceSummary } from "@/lib/callInsights";
import { ArrowLeft, CheckCircle2, AlertTriangle, XCircle, Flame, UserCheck, PhoneCall, Calendar, Clock, MessageSquareQuote, ClipboardList, Trophy, MinusCircle } from "lucide-react";
import { formatDate, formatDuration } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CallReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const call = await getCallById(id);

  if (!call) {
    notFound();
  }

  const ev = call.evaluation;
  const officialScript = await getActiveScriptForStage(call.callStage);
  const divergence = ev?.scriptDivergence;
  const divSummary = divergenceSummary(divergence);

  // Where this call ranks against every other call in the bank.
  const ranked = rankCalls(await getAllCalls());
  const thisRank = ranked.find((r) => r.id === call.id);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Back button & Stage Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/calls"
          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Call Bank
        </Link>
        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
          <Calendar className="h-3.5 w-3.5 text-slate-500" />
          {formatDate(call.createdAt)}
        </div>
      </div>

      {/* 1. Call Metadata & Stage Header */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="rounded bg-blue-500/10 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-blue-400 border border-blue-500/20">
                Stage: {call.callStage}
              </span>
              <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300 border border-slate-700 font-mono">
                Duration: {formatDuration(call.durationSeconds)}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Call with {call.prospectName}
            </h1>
            <p className="text-sm text-slate-400">
              {call.prospectCompany} • Rep: <Link href={`/reps/${call.repId}`} className="text-blue-400 hover:underline font-medium">{call.repName}</Link>
            </p>
          </div>

          <div className="flex flex-col sm:items-end gap-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Core Outcome</span>
            <span className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold border ${
              call.coreOutcome.toLowerCase().includes("booked")
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                : call.coreOutcome.toLowerCase().includes("dropped")
                ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                : "bg-amber-500/10 text-amber-400 border-amber-500/30"
            }`}>
              {call.coreOutcome}
            </span>
          </div>
        </div>

        {/* Section 1 Metadata quick summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 text-xs">
          <div>
            <span className="text-slate-500 uppercase font-semibold text-[10px] block">Rep Name</span>
            <span className="text-slate-200 font-medium text-sm">{call.repName}</span>
          </div>
          <div>
            <span className="text-slate-500 uppercase font-semibold text-[10px] block">Call Type Detected</span>
            <span className="text-slate-200 font-medium text-sm">{ev?.callTypeDetected || call.callStage}</span>
          </div>
          <div>
            <span className="text-slate-500 uppercase font-semibold text-[10px] block">Pipeline State</span>
            <span className="text-slate-200 font-medium text-sm">{call.coreOutcome}</span>
          </div>
          {thisRank && (
            <div>
              <span className="text-slate-500 uppercase font-semibold text-[10px] block">Call Rank</span>
              <span className="inline-flex items-center gap-1.5 text-sm font-bold text-white">
                {thisRank.rank === 1 && <Trophy className="h-3.5 w-3.5 text-amber-300" />}
                #{thisRank.rank} of {ranked.length}
                <span className="text-slate-500 font-mono font-normal">({thisRank.score}/100)</span>
              </span>
            </div>
          )}
        </div>
      </div>

      {ev ? (
        <>
          {/* 2. The Bottom Line (Manager's Quick Take) */}
          <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-6 space-y-2">
            <div className="flex items-center gap-2 text-blue-400 font-bold text-xs uppercase tracking-wider">
              <UserCheck className="h-4 w-4" /> 2. The Bottom Line (Manager's Quick Take)
            </div>
            <p className="text-base font-semibold text-slate-100 leading-relaxed">
              {ev.bottomLine}
            </p>
          </div>

          {/* 3. Critical Missed Opportunities (The "Fight for the Win" Check) */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-6 space-y-4">
            <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider">
                  <Flame className="h-4 w-4" /> 3. Critical Missed Opportunities (The "Fight for the Win" Check)
                </div>
                <h2 className="text-lg font-bold text-white mt-1">Objection Surrenders & Missed Openings</h2>
              </div>
              <span className="rounded bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-400 border border-rose-500/20">
                {ev.missedOpportunities.length} Moments Flagged
              </span>
            </div>

            <div className="space-y-4">
              {ev.missedOpportunities.map((opp, idx) => (
                <div key={idx} className="rounded-lg border border-slate-800 bg-slate-950 overflow-hidden">
                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800">
                    {/* Left: What happened */}
                    <div className="p-4 space-y-3">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                          <MessageSquareQuote className="h-3.5 w-3.5 text-slate-500" />
                          Prospect Opening / Soft Objection
                        </span>
                        <p className="text-sm font-semibold text-white mt-1 italic">
                          "{opp.prospectOpening}"
                        </p>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                          <XCircle className="h-3.5 w-3.5 text-rose-500" />
                          Rep Surrender / Blunder
                        </span>
                        <p className="text-xs text-rose-300 mt-1 font-medium">
                          "{opp.repSurrender}"
                        </p>
                      </div>
                    </div>

                    {/* Right: What to say instead */}
                    <div className="p-4 bg-emerald-500/5 flex flex-col justify-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 mb-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        Exact phrase rep should have said instead
                      </span>
                      <p className="text-sm text-emerald-200 font-medium leading-relaxed bg-slate-900/90 border border-emerald-500/20 rounded-md p-3">
                        "{opp.whatToSayInstead}"
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 4. Sandler & Process Breakdown */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-6 space-y-5">
            <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-blue-400 font-bold text-xs uppercase tracking-wider">
                  <CheckCircle2 className="h-4 w-4" /> 4. Sandler & Process Breakdown
                </div>
                <h2 className="text-lg font-bold text-white mt-1">Stage-Specific Qualification</h2>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 uppercase font-semibold">Script Adherence:</span>
                <span className={`text-base font-bold font-mono px-2 py-0.5 rounded border ${
                  ev.sandlerBreakdown.scriptAdherence.score >= 8
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : ev.sandlerBreakdown.scriptAdherence.score >= 6
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                }`}>
                  {ev.sandlerBreakdown.scriptAdherence.score} / 10
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Pain */}
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Pain</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                    ev.sandlerBreakdown.pain.status === "Pass"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : ev.sandlerBreakdown.pain.status === "Incomplete"
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-rose-500/20 text-rose-400"
                  }`}>
                    {ev.sandlerBreakdown.pain.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {ev.sandlerBreakdown.pain.evidence}
                </p>
              </div>

              {/* Budget */}
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Budget</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                    ev.sandlerBreakdown.budget.status === "Pass"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : ev.sandlerBreakdown.budget.status === "Incomplete"
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-rose-500/20 text-rose-400"
                  }`}>
                    {ev.sandlerBreakdown.budget.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {ev.sandlerBreakdown.budget.evidence}
                </p>
              </div>

              {/* Decision */}
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Decision</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                    ev.sandlerBreakdown.decision.status === "Pass"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : ev.sandlerBreakdown.decision.status === "Incomplete"
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-rose-500/20 text-rose-400"
                  }`}>
                    {ev.sandlerBreakdown.decision.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {ev.sandlerBreakdown.decision.evidence}
                </p>
              </div>
            </div>

            {/* Script Adherence Note */}
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-300">
              <span className="font-semibold text-slate-200">Process & Script Feedback:</span>{" "}
              {ev.sandlerBreakdown.scriptAdherence.feedback}
            </div>
          </div>

          {/* 5. Official Script Divergence */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-6 space-y-5">
            <div className="border-b border-slate-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider">
                  <ClipboardList className="h-4 w-4" /> 5. Script Divergence
                </div>
                <h2 className="text-lg font-bold text-white mt-1">
                  Measured Against: {divergence?.scriptTitle || officialScript?.title || `Standard ${call.callStage} Playbook`}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  The official prescribed playbook for a <span className="font-semibold text-slate-300">{call.callStage}</span>, checked milestone-by-milestone.
                </p>
              </div>

              {divSummary.total > 0 && (
                <div className="flex items-center gap-2 font-mono text-xs shrink-0">
                  <span className="rounded bg-emerald-500/10 px-2 py-1 font-bold text-emerald-400 border border-emerald-500/20">
                    {divSummary.hit} Hit
                  </span>
                  <span className="rounded bg-amber-500/10 px-2 py-1 font-bold text-amber-400 border border-amber-500/20">
                    {divSummary.partial} Partial
                  </span>
                  <span className="rounded bg-rose-500/10 px-2 py-1 font-bold text-rose-400 border border-rose-500/20">
                    {divSummary.missed} Missed
                  </span>
                </div>
              )}
            </div>

            {divergence && divergence.milestones.length > 0 ? (
              <div className="space-y-3">
                {divergence.milestones.map((m, idx) => {
                  const tone =
                    m.status === "Hit"
                      ? {
                          border: "border-emerald-500/30",
                          bg: "bg-emerald-500/5",
                          badge: "bg-emerald-500/20 text-emerald-400",
                          icon: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
                        }
                      : m.status === "Partial"
                      ? {
                          border: "border-amber-500/30",
                          bg: "bg-amber-500/5",
                          badge: "bg-amber-500/20 text-amber-400",
                          icon: <MinusCircle className="h-4 w-4 text-amber-400" />,
                        }
                      : {
                          border: "border-rose-500/30",
                          bg: "bg-rose-500/5",
                          badge: "bg-rose-500/20 text-rose-400",
                          icon: <XCircle className="h-4 w-4 text-rose-400" />,
                        };

                  return (
                    <div
                      key={idx}
                      className={`rounded-lg border ${tone.border} ${tone.bg} p-4 flex items-start gap-3`}
                    >
                      <div className="mt-0.5 shrink-0">{tone.icon}</div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-semibold text-white">
                            Milestone {idx + 1}: {m.milestone}
                          </span>
                          <span className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${tone.badge}`}>
                            {m.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">{m.note}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">
                No milestone-level divergence recorded for this call yet.
              </p>
            )}

            {officialScript?.content && (
              <details className="rounded-lg border border-slate-800 bg-slate-950 p-4 group">
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-white transition list-none flex items-center gap-2">
                  <ClipboardList className="h-3.5 w-3.5" /> View Full Prescribed Playbook
                </summary>
                <pre className="mt-3 font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {officialScript.content}
                </pre>
              </details>
            )}
          </div>

          {/* 6. Top 2 Priority Fixes for Next Call */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-6 space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                <CheckCircle2 className="h-4 w-4" /> 6. Top 2 Priority Fixes for Next Call
              </div>
              <h2 className="text-lg font-bold text-white mt-1">High-Leverage Blocking & Tackling Corrections</h2>
              <p className="text-xs text-slate-400">
                No laundry list of 20 issues. Nail these two fundamentals before the next conversation.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/20 text-[11px] font-bold text-blue-400">
                    1
                  </span>
                  <h3 className="text-sm font-bold text-white">{ev.topFixes[0]?.title}</h3>
                </div>
                <p className="text-xs text-slate-400 pl-7 leading-relaxed">
                  {ev.topFixes[0]?.description}
                </p>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/20 text-[11px] font-bold text-blue-400">
                    2
                  </span>
                  <h3 className="text-sm font-bold text-white">{ev.topFixes[1]?.title}</h3>
                </div>
                <p className="text-xs text-slate-400 pl-7 leading-relaxed">
                  {ev.topFixes[1]?.description}
                </p>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-6 text-center space-y-2">
          <Clock className="h-8 w-8 text-amber-400 mx-auto animate-pulse" />
          <h3 className="text-base font-bold text-white">Call Evaluation In Progress</h3>
          <p className="text-xs text-amber-200/80 max-w-md mx-auto">
            The AI Sales Manager is currently scanning this call against the 5 coaching dimensions. Refresh in a few seconds.
          </p>
        </div>
      )}

      {/* Transcript Inspector */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/90 overflow-hidden">
        <div className="border-b border-slate-800 px-6 py-4">
          <h3 className="text-sm font-bold text-white tracking-tight uppercase tracking-wider text-xs">
            Full Call Transcript
          </h3>
        </div>
        <div className="p-6 bg-slate-950">
          <pre className="font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
            {call.transcriptText}
          </pre>
        </div>
      </div>
    </div>
  );
}

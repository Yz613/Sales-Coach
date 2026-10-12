import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Flame,
  UserCheck,
  ClipboardList,
  Trophy,
  MessageSquareQuote,
} from "lucide-react";
import CoachingBriefCard from "@/components/CoachingBrief";
import CoachWalkthrough from "@/components/CoachWalkthrough";
import DemoFrame from "@/components/demo/DemoFrame";
import DemoAudioPlayer from "@/components/demo/DemoAudioPlayer";
import DemoAskCoach from "@/components/demo/DemoAskCoach";
import DemoCallWorkspace from "@/components/demo/DemoCallWorkspace";
import ScorecardGrid from "@/components/ScorecardGrid";
import SandlerDebrief from "@/components/SandlerDebrief";
import CallReviewSwitcher from "@/components/CallReviewSwitcher";
import {
  DEMO_CALLS,
  DEMO_DISABLED_ACTIONS,
  DEMO_SELF_HOST_HREF,
  DEMO_SIGN_UP_HREF,
  demoCallById,
  demoOverallScore,
} from "@/lib/demo/workspace";
import { formatDuration } from "@/lib/utils";

export function generateStaticParams() {
  return DEMO_CALLS.map((call) => ({ id: call.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const call = demoCallById(id);
  if (!call) return { title: "Sample call — Sales Coach" };
  return {
    metadataBase: new URL("https://refreshqueue.com"),
    title: `${call.company} — sample call review`,
    description: call.summary,
    alternates: { canonical: `/demo/${call.id}` },
  };
}

export default async function DemoCallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const call = demoCallById(id);
  if (!call) notFound();

  const isTopRanked = call.rank === 1;
  const scoreVal = demoOverallScore(call);

  const quickPillars = [
    {
      id: "pain",
      label: "Pain Qualification",
      done: call.sandlerBreakdown.pain.status === "Pass",
      evidence: call.sandlerBreakdown.pain.evidence,
    },
    {
      id: "budget",
      label: "Budget Qualification",
      done: call.sandlerBreakdown.budget.status === "Pass",
      evidence: call.sandlerBreakdown.budget.evidence,
    },
    {
      id: "decision",
      label: "Decision Authority",
      done: call.sandlerBreakdown.decision.status === "Pass",
      evidence: call.sandlerBreakdown.decision.evidence,
    },
  ];

  const quickHighlights = call.debrief
    .filter((mark) => mark.highlight)
    .map((mark) => ({
      id: mark.id,
      label: mark.label,
      done: mark.status === "Handled",
      evidence: mark.evidence,
    }));

  return (
    <DemoFrame>
      <div className="space-y-8 max-w-5xl mx-auto">
        {/* Navigation Breadcrumb & Meta Bar */}
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/demo"
            className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-black/[0.04] px-3.5 py-1.5 text-xs font-semibold text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-black/[0.06] transition"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Sample Calls
          </Link>
          <div className="flex items-center gap-3 text-xs text-[#6e6e73] font-mono">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-[#86868b]" />
              {call.recordedOn}
            </span>
            <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#007AFF] border border-blue-500/20">
              Evaluated with Rubric Engine
            </span>
          </div>
        </div>

        {/* 1. Call Header Card */}
        <div className="rounded-2xl glass-card p-6 sm:p-7 border border-black/[0.08]">
          <div className="flex flex-col-reverse sm:flex-row sm:items-start justify-between gap-5 border-b border-black/[0.08] pb-5">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="rounded-full bg-blue-500/10 px-3 py-0.5 text-xs font-semibold uppercase tracking-wider text-[#007AFF] border border-blue-500/20">
                  Stage: {call.stage}
                </span>
                <span className="rounded-full bg-black/[0.04] px-3 py-0.5 text-xs text-[#3a3a3c] border border-black/[0.08] font-mono">
                  Duration: {formatDuration(call.durationSeconds)}
                </span>
                <span className="rounded-full bg-black/[0.04] px-3 py-0.5 text-xs font-semibold text-[#3a3a3c] border border-black/[0.08]">
                  {call.outcome}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1d1d1f] tracking-tight">
                {call.company}
              </h1>
              <p className="text-sm text-[#6e6e73] mt-1">
                {call.repName} ({call.repRole}) with {call.prospectName}, {call.prospectTitle}
              </p>
            </div>

            <div className="flex flex-col items-start sm:items-end gap-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#86868b]">Score</span>
              <p
                className={`font-mono font-black leading-none tracking-tight text-5xl sm:text-6xl ${
                  scoreVal >= 8
                    ? "text-[#248A3D]"
                    : scoreVal >= 6
                    ? "text-[#C45500]"
                    : "text-[#FF3B30]"
                }`}
              >
                {scoreVal.toFixed(1)}
                <span className="text-2xl text-[#86868b] font-semibold"> / 10</span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 text-xs">
            <div>
              <span className="text-[#86868b] uppercase font-semibold text-[10px] block">Sales Rep</span>
              <span className="text-[#1d1d1f] font-semibold text-sm">{call.repName}</span>
            </div>
            <div>
              <span className="text-[#86868b] uppercase font-semibold text-[10px] block">Call Stage Target</span>
              <span className="text-[#1d1d1f] font-semibold text-sm">{call.stage}</span>
            </div>
            <div>
              <span className="text-[#86868b] uppercase font-semibold text-[10px] block">Outcome</span>
              <span className="text-[#1d1d1f] font-semibold text-sm">{call.outcome}</span>
            </div>
            <div>
              <span className="text-[#86868b] uppercase font-semibold text-[10px] block">Call Bank Rank</span>
              <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[#1d1d1f]">
                {isTopRanked && <Trophy className="h-3.5 w-3.5 text-[#FF9500]" />}
                #{call.rank} of {DEMO_CALLS.length}
                <span className="text-[#86868b] font-mono font-normal">({call.rankScore}/100)</span>
              </span>
            </div>
          </div>

          <p className="mt-4 text-xs leading-relaxed text-[#3a3a3c] border-t border-black/[0.04] pt-3">
            {call.summary}
          </p>

          <div className="mt-4 flex flex-wrap gap-2" aria-label="Disabled in the public demo">
            {DEMO_DISABLED_ACTIONS.map((action) => (
              <button
                key={action.id}
                type="button"
                disabled
                aria-disabled="true"
                title="Disabled in the public demo"
                className="cursor-not-allowed rounded-full bg-black/[0.04] px-3 py-1.5 text-xs font-semibold text-[#86868b] opacity-70"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>

        {/* Interactive Audio Player & Synchronized Transcript */}
        <DemoAudioPlayer
          transcriptText={call.transcriptText}
          durationSeconds={call.durationSeconds}
        />

        {/* Interactive Ask AI Sales Coach */}
        <DemoAskCoach callCompany={call.company} demoAnswers={call.demoAnswers} />

        {/* Call Review Switcher (Quick take vs Full review) */}
        <CallReviewSwitcher
          methodName="Sandler Selling System"
          pillars={quickPillars}
          highlights={quickHighlights}
          defaultFull
        >
          {/* 2. The Bottom Line (Manager's Quick Take) */}
          <div className="rounded-2xl border border-blue-500/25 bg-blue-500/[0.05] p-6 sm:p-7 space-y-2.5 shadow-sm">
            <div className="flex items-center gap-2 text-[#007AFF] font-bold text-xs uppercase tracking-wider">
              <UserCheck className="h-4 w-4" /> 2. The Bottom Line (Manager's Quick Take)
            </div>
            <p className="text-base font-medium text-[#1d1d1f] leading-relaxed">
              {call.bottomLine}
            </p>
            <p className="text-[11px] text-[#6e6e73] font-mono">
              Reviewed with Sales Coach Rubric Engine · Deterministic 10-dimension evaluation
            </p>
          </div>

          {/* Coaching Brief (Praise, Tactical Gaps, Drills) */}
          <CoachingBriefCard brief={call.coaching} />

          {/* Sandler Debrief Checklist */}
          {call.debrief.length > 0 && (
            <SandlerDebrief marks={call.debrief} methodName="Sandler Selling System" />
          )}

          {/* Coaching Scorecard Grid */}
          <div className="rounded-2xl glass-card p-6 sm:p-7 space-y-4 border border-black/[0.08]">
            <div>
              <div className="flex items-center gap-2 text-[#5856D6] font-bold text-xs uppercase tracking-wider">
                <ClipboardList className="h-4 w-4" /> Coaching Scorecard
              </div>
              <h2 className="text-lg font-bold text-[#1d1d1f] mt-1 tracking-tight">
                {call.scorecard.length} rubric dimensions, each tied to a moment on the call
              </h2>
              <p className="text-xs text-[#6e6e73]">Click any timestamp cite to jump to that moment in the transcript.</p>
            </div>
            <ScorecardGrid metrics={call.scorecard} />
          </div>

          {/* Coach Walkthrough (Moment-by-moment) */}
          {call.walkthrough.length > 0 && <CoachWalkthrough steps={call.walkthrough} />}

          {/* 3. Critical Missed Opportunities ("Fight for the Win" Check) */}
          {call.missedOpportunities.length > 0 && (
            <div className="rounded-2xl glass-card p-6 sm:p-7 space-y-4 border border-black/[0.08]">
              <div className="border-b border-black/[0.08] pb-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 text-[#FF3B30] font-bold text-xs uppercase tracking-wider">
                    <Flame className="h-4 w-4" /> 3. Critical Missed Opportunities (The "Fight for the Win" Check)
                  </div>
                  <h2 className="text-lg font-bold text-[#1d1d1f] mt-1 tracking-tight">
                    Objection Surrenders & Missed Openings
                  </h2>
                </div>
                <span className="rounded-full bg-rose-500/10 px-3 py-1 text-xs font-semibold text-[#FF3B30] border border-rose-500/20">
                  {call.missedOpportunities.length} Moments Flagged
                </span>
              </div>

              <div className="space-y-4">
                {call.missedOpportunities.map((opp, idx) => (
                  <div key={idx} className="rounded-2xl glass-inset overflow-hidden border border-black/[0.06]">
                    <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-black/[0.06]">
                      <div className="p-5 space-y-3">
                        {opp.timestampSeconds != null && (
                          <a
                            href={`#t-${opp.timestampSeconds}`}
                            className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.04] px-2.5 py-0.5 font-mono text-[11px] text-[#007AFF] border border-black/[0.08] hover:border-blue-500 transition"
                          >
                            <Clock className="h-3 w-3" />
                            {opp.timestamp} on the call
                          </a>
                        )}
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#6e6e73] flex items-center gap-1.5">
                            <MessageSquareQuote className="h-3.5 w-3.5 text-[#86868b]" />
                            Prospect Opening / Soft Objection
                          </span>
                          <p className="text-sm font-semibold text-[#1d1d1f] mt-1 italic">
                            "{opp.prospectQuote || opp.prospectOpening}"
                          </p>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF3B30] flex items-center gap-1.5">
                            <XCircle className="h-3.5 w-3.5 text-[#FF3B30]" />
                            Rep Surrender / Blunder
                          </span>
                          <p className="text-xs text-[#D70015] mt-1 font-medium">
                            "{opp.repQuote || opp.repSurrender}"
                          </p>
                        </div>
                      </div>

                      <div className="p-5 bg-emerald-500/[0.04] flex flex-col justify-center">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#248A3D] flex items-center gap-1.5 mb-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          Exact phrase rep should have said instead
                        </span>
                        <p className="text-sm text-[#1d1d1f] font-normal leading-relaxed glass-card border border-emerald-500/20 rounded-xl p-3.5">
                          "{opp.whatToSayInstead}"
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. Stage-Specific Qualification (Methodology Breakdown) */}
          <div className="rounded-2xl glass-card p-6 sm:p-7 space-y-5 border border-black/[0.08]">
            <div className="border-b border-black/[0.08] pb-3 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-[#007AFF] font-bold text-xs uppercase tracking-wider">
                  <CheckCircle2 className="h-4 w-4" /> 4. Sandler Selling System
                </div>
                <h2 className="text-lg font-bold text-[#1d1d1f] mt-1 tracking-tight">Stage-Specific Qualification</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#6e6e73] uppercase font-semibold">Script Adherence:</span>
                <span className="text-base font-bold font-mono px-3 py-0.5 rounded-full border bg-emerald-500/10 text-[#248A3D] border-emerald-500/20">
                  {call.sandlerBreakdown.scriptAdherence.score} / 10
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-2xl glass-inset p-5 space-y-2.5 border border-black/[0.06]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#3a3a3c]">Pain Qualification</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      call.sandlerBreakdown.pain.status === "Pass"
                        ? "bg-emerald-500/20 text-[#248A3D]"
                        : call.sandlerBreakdown.pain.status === "Incomplete"
                        ? "bg-amber-500/20 text-[#C45500]"
                        : "bg-rose-500/20 text-[#FF3B30]"
                    }`}
                  >
                    {call.sandlerBreakdown.pain.status}
                  </span>
                </div>
                <p className="text-xs text-[#6e6e73] leading-relaxed">{call.sandlerBreakdown.pain.evidence}</p>
              </div>

              <div className="rounded-2xl glass-inset p-5 space-y-2.5 border border-black/[0.06]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#3a3a3c]">Budget Qualification</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      call.sandlerBreakdown.budget.status === "Pass"
                        ? "bg-emerald-500/20 text-[#248A3D]"
                        : call.sandlerBreakdown.budget.status === "Incomplete"
                        ? "bg-amber-500/20 text-[#C45500]"
                        : "bg-rose-500/20 text-[#FF3B30]"
                    }`}
                  >
                    {call.sandlerBreakdown.budget.status}
                  </span>
                </div>
                <p className="text-xs text-[#6e6e73] leading-relaxed">{call.sandlerBreakdown.budget.evidence}</p>
              </div>

              <div className="rounded-2xl glass-inset p-5 space-y-2.5 border border-black/[0.06]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#3a3a3c]">Decision Authority</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      call.sandlerBreakdown.decision.status === "Pass"
                        ? "bg-emerald-500/20 text-[#248A3D]"
                        : call.sandlerBreakdown.decision.status === "Incomplete"
                        ? "bg-amber-500/20 text-[#C45500]"
                        : "bg-rose-500/20 text-[#FF3B30]"
                    }`}
                  >
                    {call.sandlerBreakdown.decision.status}
                  </span>
                </div>
                <p className="text-xs text-[#6e6e73] leading-relaxed">{call.sandlerBreakdown.decision.evidence}</p>
              </div>
            </div>

            <div className="rounded-xl border border-black/[0.06] glass-inset p-3.5 text-xs text-[#3a3a3c]">
              <span className="font-semibold text-[#1d1d1f]">Process & Script Feedback:</span>{" "}
              {call.sandlerBreakdown.scriptAdherence.feedback}
            </div>
          </div>

          {/* 5. Official Script Divergence */}
          <div className="rounded-2xl glass-card p-6 sm:p-7 space-y-5 border border-black/[0.08]">
            <div className="border-b border-black/[0.08] pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-[#5856D6] font-bold text-xs uppercase tracking-wider">
                  <ClipboardList className="h-4 w-4" /> 5. Script Divergence
                </div>
                <h2 className="text-lg font-bold text-[#1d1d1f] mt-1 tracking-tight">
                  Measured Against: {call.scriptDivergence.scriptTitle}
                </h2>
                <p className="text-xs text-[#6e6e73] mt-0.5">
                  Checked milestone-by-milestone against the prescribed playbook for a{" "}
                  <span className="font-semibold text-[#3a3a3c]">{call.stage}</span>.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {call.scriptDivergence.milestones.map((m, idx) => {
                const isHit = m.status === "Hit";
                const isPartial = m.status === "Partial";
                return (
                  <div
                    key={idx}
                    className={`rounded-2xl border p-5 flex items-start gap-3.5 ${
                      isHit
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : isPartial
                        ? "border-amber-500/30 bg-amber-500/5"
                        : "border-rose-500/30 bg-rose-500/5"
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {isHit ? (
                        <CheckCircle2 className="h-4 w-4 text-[#248A3D]" />
                      ) : isPartial ? (
                        <MinusCircle className="h-4 w-4 text-[#C45500]" />
                      ) : (
                        <XCircle className="h-4 w-4 text-[#FF3B30]" />
                      )}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-[#1d1d1f]">
                          Milestone {idx + 1}: {m.milestone}
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase ${
                            isHit
                              ? "bg-emerald-500/20 text-[#248A3D]"
                              : isPartial
                              ? "bg-amber-500/20 text-[#C45500]"
                              : "bg-rose-500/20 text-[#FF3B30]"
                          }`}
                        >
                          {m.status}
                        </span>
                      </div>
                      {m.timestamp && (
                        <span className="inline-flex font-mono text-[11px] text-[#0071E3]">
                          {m.timestamp}
                        </span>
                      )}
                      <p className="text-xs text-[#6e6e73] leading-relaxed">{m.note}</p>
                      {m.quote && <p className="text-xs text-[#3a3a3c] italic">“{m.quote}”</p>}
                    </div>
                  </div>
                );
              })}
            </div>

            {call.officialScriptContent && (
              <details className="rounded-2xl border border-black/[0.06] glass-inset p-5 group">
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-[#6e6e73] hover:text-[#1d1d1f] transition list-none flex items-center gap-2">
                  <ClipboardList className="h-3.5 w-3.5" /> View Full Prescribed Playbook
                </summary>
                <pre className="mt-3 font-mono text-xs text-[#3a3a3c] leading-relaxed whitespace-pre-wrap">
                  {call.officialScriptContent}
                </pre>
              </details>
            )}
          </div>

          {/* 6. Top 2 Priority Fixes */}
          <div className="rounded-2xl glass-card p-6 sm:p-7 space-y-4 border border-black/[0.08]">
            <div className="border-b border-black/[0.08] pb-3">
              <div className="flex items-center gap-2 text-[#248A3D] font-bold text-xs uppercase tracking-wider">
                <CheckCircle2 className="h-4 w-4" /> 6. Top 2 Priority Fixes for Next Call
              </div>
              <h2 className="text-lg font-bold text-[#1d1d1f] mt-1 tracking-tight">
                High-Leverage Blocking & Tackling Corrections
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl glass-inset p-5 space-y-2 border border-black/[0.06]">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/20 text-xs font-bold text-[#007AFF] border border-blue-500/30">
                    1
                  </span>
                  <h3 className="text-sm font-semibold text-[#1d1d1f]">{call.topFixes[0]?.title}</h3>
                </div>
                <p className="text-xs text-[#6e6e73] pl-[34px] leading-relaxed">
                  {call.topFixes[0]?.description}
                </p>
              </div>

              <div className="rounded-2xl glass-inset p-5 space-y-2 border border-black/[0.06]">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/20 text-xs font-bold text-[#007AFF] border border-blue-500/30">
                    2
                  </span>
                  <h3 className="text-sm font-semibold text-[#1d1d1f]">{call.topFixes[1]?.title}</h3>
                </div>
                <p className="text-xs text-[#6e6e73] pl-[34px] leading-relaxed">
                  {call.topFixes[1]?.description}
                </p>
              </div>
            </div>
          </div>
        </CallReviewSwitcher>

        {/* Conversation Workspace (Notes, Overrides, Deals) */}
        <DemoCallWorkspace
          callCompany={call.company}
          repName={call.repName}
          scorecard={call.scorecard}
        />

        {/* Trackers Section */}
        <section className="mt-6" aria-label="Trackers">
          <h2 className="text-sm font-bold">Trackers</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {call.trackers.map((tracker) => (
              <article key={tracker.id} className="rounded-2xl glass-inset p-4 border border-black/[0.06]">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#007AFF]">
                  {tracker.name} · {tracker.kind}
                </p>
                <ul className="mt-2 space-y-2">
                  {tracker.hits.map((hit) => (
                    <li key={`${tracker.id}-${hit.timestampSeconds}`}>
                      <a href={`#t-${hit.timestampSeconds}`} className="text-xs text-[#3a3a3c] hover:text-[#007AFF]">
                        <span className="font-mono font-semibold">{hit.timestamp}</span> {hit.speaker}: {hit.quote}
                      </a>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        {/* CTA Footer */}
        <aside className="mt-8 rounded-2xl border border-[#007AFF]/20 bg-[#007AFF]/[0.06] p-5">
          <h2 className="text-base font-semibold">Use this with your own calls</h2>
          <p className="mt-1 text-sm leading-relaxed text-[#3a3a3c]">
            Sign up for the hosted workspace, or self-host the MIT repo and score calls on your machine.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm font-medium">
            <a href={DEMO_SIGN_UP_HREF} className="rounded-full bg-[#007AFF] px-4 py-2 text-white hover:bg-[#0071E3]">
              Sign up
            </a>
            <a href={DEMO_SELF_HOST_HREF} className="rounded-full bg-white px-4 py-2 shadow-[0_0_0_1px_rgba(0,0,0,0.08)]">
              Self-host
            </a>
          </div>
        </aside>
      </div>
    </DemoFrame>
  );
}

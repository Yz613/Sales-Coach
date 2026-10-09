import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CoachingBriefCard from "@/components/CoachingBrief";
import DemoFrame from "@/components/demo/DemoFrame";
import ScorecardGrid from "@/components/ScorecardGrid";
import TimestampedTranscript from "@/components/TimestampedTranscript";
import {
  DEMO_CALLS,
  DEMO_DISABLED_ACTIONS,
  DEMO_SELF_HOST_HREF,
  DEMO_SIGN_UP_HREF,
  demoCallById,
  demoOverallScore,
} from "@/lib/demo/workspace";

export function generateStaticParams() {
  return DEMO_CALLS.map((call) => ({ id: call.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const call = demoCallById(id);
  if (!call) return { title: "Sample call — Sales Coach" };
  return {
    metadataBase: new URL("https://refreshqueue.com"),
    title: `${call.company} — sample call`,
    description: call.summary,
    alternates: { canonical: `/demo/${call.id}` },
  };
}

export default async function DemoCallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const call = demoCallById(id);
  if (!call) notFound();

  return (
    <DemoFrame>
      <a href="/demo" className="text-xs font-semibold uppercase tracking-wider text-[#6e6e73] hover:text-[#1d1d1f]">
        Back to sample calls
      </a>
      <div className="mt-4 rounded-2xl glass-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6e6e73]">{call.stage} · {call.outcome}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{call.company}</h1>
            <p className="mt-1 text-sm text-[#6e6e73]">
              {call.repName}, {call.repRole} with {call.prospectName}, {call.prospectTitle}
            </p>
          </div>
          <p className="font-mono text-lg font-semibold">{demoOverallScore(call).toFixed(1)}<span className="text-xs font-normal text-[#86868b]"> / 10</span></p>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-[#3a3a3c]">{call.summary}</p>
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

      <section className="mt-6" aria-label="Trackers">
        <h2 className="text-sm font-semibold">Trackers</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {call.trackers.map((tracker) => (
            <article key={tracker.id} className="rounded-2xl glass-inset p-4">
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

      <section className="mt-6" aria-label="Rubric scorecard">
        <h2 className="mb-3 text-sm font-semibold">Rubric scorecard</h2>
        <ScorecardGrid metrics={call.scorecard} />
      </section>

      <section className="mt-6" aria-label="Coaching notes">
        <CoachingBriefCard brief={call.coaching} />
      </section>

      <section className="mt-6" aria-label="Transcript">
        <h2 className="mb-3 text-sm font-semibold">Transcript</h2>
        <TimestampedTranscript transcriptText={call.transcriptText} durationSeconds={call.durationSeconds} />
      </section>

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
    </DemoFrame>
  );
}

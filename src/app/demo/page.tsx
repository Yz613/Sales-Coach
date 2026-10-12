import type { Metadata } from "next";
import DemoFrame from "@/components/demo/DemoFrame";
import { DEMO_CALLS, DEMO_SELF_HOST_HREF, DEMO_SIGN_UP_HREF, demoOverallScore } from "@/lib/demo/workspace";

export const metadata: Metadata = {
  metadataBase: new URL("https://refreshqueue.com"),
  title: "Sample workspace — Sales Coach",
  description:
    "Read a fictional sales workspace with call transcripts, rubric scorecards, coaching notes, and trackers. No signup.",
  alternates: { canonical: "/demo" },
};

export default function DemoIndexPage() {
  return (
    <DemoFrame>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[13px] font-medium text-[#007AFF]">Try the live demo, no signup</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Fieldnote sample team</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#6e6e73]">
            Four fictional calls. Open one for the transcript, the rubric scorecard, the coaching note, and the trackers that fired.
          </p>
        </div>
        <div className="flex gap-2 text-sm font-medium">
          <a href={DEMO_SIGN_UP_HREF} className="rounded-full bg-[#007AFF] px-4 py-2 text-white hover:bg-[#0071E3]">
            Sign up
          </a>
          <a href={DEMO_SELF_HOST_HREF} className="rounded-full bg-white px-4 py-2 shadow-[0_0_0_1px_rgba(0,0,0,0.08)]">
            Self-host
          </a>
        </div>
      </div>
      <ul className="mt-8 space-y-3">
        {DEMO_CALLS.map((call) => (
          <li key={call.id}>
            <a href={`/demo/${call.id}`} className="block rounded-2xl glass-card p-5 hover:bg-white">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold">{call.company}</p>
                  <p className="mt-1 text-sm text-[#6e6e73]">
                    {call.repName} · {call.prospectName}, {call.prospectTitle}
                  </p>
                </div>
                <p className="font-mono text-sm font-semibold">{demoOverallScore(call).toFixed(1)} / 10</p>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-[#3a3a3c]">{call.summary}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-black/[0.04] px-2 py-0.5 text-[11px] font-semibold text-[#3a3a3c]">{call.stage}</span>
                <span className="rounded-full bg-black/[0.04] px-2 py-0.5 text-[11px] font-semibold text-[#3a3a3c]">{call.outcome}</span>
                {call.trackers.map((tracker) => (
                  <span key={tracker.id} className="rounded-full bg-[#007AFF]/10 px-2 py-0.5 text-[11px] font-semibold text-[#007AFF]">
                    {tracker.name}
                  </span>
                ))}
              </div>
            </a>
          </li>
        ))}
      </ul>
    </DemoFrame>
  );
}

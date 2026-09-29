"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  ClipboardCopy,
  Flame,
  MessageSquareQuote,
} from "lucide-react";
import type { ManagerTalkTrack, TalkTrackTheme } from "@/lib/managerTalkTrack";

export default function ManagerTalkTrackCard({
  repName,
  talkTrack,
}: {
  repName: string;
  talkTrack: ManagerTalkTrack;
}) {
  const [copied, setCopied] = useState(false);
  const first = (repName || "this rep").trim().split(/\s+/)[0] || "this rep";

  const copyScript = async () => {
    if (!talkTrack.spokenScript) return;
    try {
      await navigator.clipboard.writeText(talkTrack.spokenScript);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div id="talk-track" className="rounded-2xl glass-card overflow-hidden">
      <div className="border-b border-black/[0.08] px-6 py-4.5 bg-black/[0.02] flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#007AFF]">
            <MessageSquareQuote className="h-4 w-4" />
            Manager 1:1 Talk Track
          </div>
          <h2 className="text-base font-bold text-[#1d1d1f] tracking-tight mt-1">
            What to say to {first}
          </h2>
          <p className="text-xs text-[#6e6e73] mt-1 max-w-2xl">{talkTrack.coverageNote}</p>
        </div>
        {talkTrack.spokenScript ? (
          <button
            type="button"
            onClick={copyScript}
            className="inline-flex items-center gap-1.5 rounded-xl border border-black/[0.1] bg-black/[0.04] hover:bg-black/[0.08] px-3.5 py-2 text-xs font-semibold text-[#1d1d1f] transition shrink-0"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-[#248A3D]" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy talk track"}
          </button>
        ) : null}
      </div>

      {talkTrack.evaluatedCallCount === 0 ? (
        <div className="px-6 py-8 text-sm text-[#6e6e73]">
          No evaluated calls yet. As {first}&apos;s calls land, this fills in four wins and four gaps — praise first, then what to fix, each with a real example.
        </div>
      ) : (
        <div className="p-6 space-y-6">
          <div className="rounded-2xl border border-blue-500/25 bg-blue-500/[0.06] p-5 space-y-2">
            <div className="text-[10px] uppercase font-bold tracking-wider text-[#007AFF]">
              Say this
            </div>
            <pre className="whitespace-pre-wrap text-sm text-[#1d1d1f] leading-relaxed font-sans">
              {talkTrack.spokenScript}
            </pre>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ThemeColumn
              title="What went well"
              empty="No clean win on file yet — capture one on the next call."
              themes={talkTrack.strengths}
              tone="strength"
            />
            <ThemeColumn
              title="Gaps to fix"
              empty="No repeating miss yet — keep watching the next calls."
              themes={talkTrack.struggles}
              tone="struggle"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ThemeColumn({
  title,
  empty,
  themes,
  tone,
}: {
  title: string;
  empty: string;
  themes: TalkTrackTheme[];
  tone: "struggle" | "strength";
}) {
  const Icon = tone === "struggle" ? Flame : CheckCircle2;
  const accent =
    tone === "struggle"
      ? "text-[#FF3B30] border-rose-500/20 bg-rose-500/[0.06]"
      : "text-[#248A3D] border-emerald-500/20 bg-emerald-500/[0.06]";

  return (
    <div className="rounded-2xl glass-inset border border-black/[0.06] p-4 space-y-3">
      <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${tone === "struggle" ? "text-[#FF3B30]" : "text-[#248A3D]"}`}>
        <Icon className="h-4 w-4" />
        {title}
      </div>
      {themes.length === 0 ? (
        <p className="text-xs text-[#86868b]">{empty}</p>
      ) : (
        <div className="space-y-3">
          {themes.map((theme, idx) => (
            <article key={theme.key} className={`rounded-xl border p-3.5 space-y-2 ${accent}`}>
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-[#1d1d1f]">
                  {idx + 1}. {theme.title}
                </h3>
                <span className="text-[10px] uppercase font-semibold text-[#6e6e73] whitespace-nowrap">
                  {theme.callCount} {theme.callCount === 1 ? "call" : "calls"}
                </span>
              </div>
              <p className="text-xs text-[#1d1d1f] leading-relaxed">{theme.example.whatHappened}</p>
              {theme.example.quote ? (
                <p className="text-xs text-[#3a3a3c] italic">
                  {theme.example.timestamp ? `${theme.example.timestamp} · ` : ""}
                  &ldquo;{theme.example.quote}&rdquo;
                </p>
              ) : null}
              {tone === "struggle" && theme.example.coachingNote ? (
                <p className="text-[11px] text-[#3a3a3c]">
                  <span className="font-semibold uppercase tracking-wider text-[10px] text-[#6e6e73]">
                    Say instead:{" "}
                  </span>
                  {theme.example.coachingNote}
                </p>
              ) : null}
              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-[11px] text-[#6e6e73] truncate">
                  {theme.example.callLabel}
                  {theme.example.callStage ? ` · ${theme.example.callStage}` : ""}
                </span>
                <Link
                  href={`/calls/${theme.example.callId}`}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#007AFF] hover:text-[#0071E3] transition"
                >
                  Open example <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

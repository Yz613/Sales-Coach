"use client";

import Link from "next/link";
import { BookOpen, ArrowUpRight, Play, Headphones } from "lucide-react";
import { DEMO_LIBRARY } from "@/lib/demo/workspace";
import { formatDuration } from "@/lib/utils";

export default function DemoLibraryView() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-[#1d1d1f]">Coaching Library & Snippets</h2>
        <p className="text-xs text-[#6e6e73] mt-0.5">
          Curated call moments saved by managers for team training, onboarding, and rep playbooks.
        </p>
      </div>

      <div className="space-y-6">
        {DEMO_LIBRARY.map((group) => (
          <section key={group.collection} className="space-y-3">
            <h3 className="text-sm font-bold text-[#1d1d1f] flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#007AFF]" />
              {group.collection}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {group.clips.map((clip) => (
                <Link
                  key={clip.id}
                  href={`/demo/${clip.callId}#t-${clip.start}-${clip.end}`}
                  className="rounded-2xl glass-card p-5 space-y-3 border border-black/[0.08] hover:border-blue-400 hover:shadow-sm transition group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs font-bold text-[#1d1d1f] group-hover:text-[#007AFF] transition line-clamp-2">
                      {clip.title}
                    </h4>
                    <span className="rounded-full bg-blue-500/10 p-1 text-[#007AFF] shrink-0">
                      <Play className="h-3 w-3 fill-current ml-0.5" />
                    </span>
                  </div>

                  <p className="text-[11px] text-[#6e6e73]">
                    {clip.repName} · {clip.company}
                  </p>

                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-black/[0.04]">
                    <span className="font-mono text-[#007AFF] font-semibold">
                      {formatDuration(clip.start)} – {formatDuration(clip.end)}
                    </span>
                    <span className="text-[#6e6e73] group-hover:text-[#007AFF] font-medium flex items-center gap-0.5">
                      Open moment <ArrowUpRight className="h-3 w-3" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

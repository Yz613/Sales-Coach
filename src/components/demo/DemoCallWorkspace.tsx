"use client";

import { useState } from "react";
import { MessageSquare, ShieldCheck, Briefcase, Plus, Check } from "lucide-react";
import type { ScorecardMetric } from "@/lib/ai/review";

export default function DemoCallWorkspace({
  callCompany,
  repName,
  scorecard,
}: {
  callCompany: string;
  repName: string;
  scorecard: ScorecardMetric[];
}) {
  const [tab, setTab] = useState<"notes" | "overrides" | "deals">("notes");
  const [comments, setComments] = useState<Array<{ id: string; author: string; role: string; text: string; time: string }>>([
    {
      id: "c1",
      author: "Alex Morgan",
      role: "Sales VP",
      text: `Reviewed with ${repName}. Solid pattern interrupt, but let us make sure we quantify cost before the next screen share.`,
      time: "2 days ago",
    },
  ]);
  const [newComment, setNewComment] = useState("");
  const [overrides, setOverrides] = useState<Array<{ metricKey: string; oldScore: number; newScore: number; author: string; reason: string }>>([
    {
      metricKey: "budget",
      oldScore: 3,
      newScore: 4,
      author: "Alex Morgan",
      reason: "Adjusted up slightly because rep at least acknowledged pricing envelope before joint meeting.",
    },
  ]);

  const addComment = () => {
    if (!newComment.trim()) return;
    setComments((prev) => [
      ...prev,
      {
        id: `c-${Date.now()}`,
        author: "You (Demo Manager)",
        role: "Sales Coach",
        text: newComment.trim(),
        time: "Just now",
      },
    ]);
    setNewComment("");
  };

  return (
    <div className="rounded-2xl glass-card overflow-hidden border border-black/[0.08]">
      <div className="border-b border-black/[0.08] px-6 py-3 flex items-center justify-between gap-3 bg-black/[0.02]">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setTab("notes")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              tab === "notes" ? "bg-[#007AFF] text-white shadow-xs" : "text-[#6e6e73] hover:text-[#1d1d1f]"
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" /> Notes & Comments ({comments.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("overrides")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              tab === "overrides" ? "bg-[#007AFF] text-white shadow-xs" : "text-[#6e6e73] hover:text-[#1d1d1f]"
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" /> Score Overrides ({overrides.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("deals")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              tab === "deals" ? "bg-[#007AFF] text-white shadow-xs" : "text-[#6e6e73] hover:text-[#1d1d1f]"
            }`}
          >
            <Briefcase className="h-3.5 w-3.5" /> CRM Deal Link
          </button>
        </div>
        <span className="text-[11px] text-[#86868b] font-medium hidden sm:inline">Conversation Workspace</span>
      </div>

      <div className="p-6">
        {tab === "notes" && (
          <div className="space-y-4">
            <div className="space-y-3">
              {comments.map((c) => (
                <div key={c.id} className="rounded-xl border border-black/[0.06] bg-white p-4 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#1d1d1f]">
                      {c.author} · <span className="font-normal text-[#6e6e73]">{c.role}</span>
                    </span>
                    <span className="text-[#86868b] text-[11px]">{c.time}</span>
                  </div>
                  <p className="text-xs text-[#3a3a3c] leading-relaxed">{c.text}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addComment()}
                placeholder="Leave a coaching note for this call..."
                className="flex-1 rounded-xl bg-white border border-black/[0.08] px-3.5 py-2 text-xs text-[#1d1d1f] placeholder:text-[#86868b] focus:border-blue-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={addComment}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#007AFF] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0071E3] transition shadow-xs"
              >
                <Plus className="h-3.5 w-3.5" /> Add Note
              </button>
            </div>
          </div>
        )}

        {tab === "overrides" && (
          <div className="space-y-3">
            <p className="text-xs text-[#6e6e73]">
              Human managers can override any automated AI rubric score with an explanation, updating team coaching benchmarks.
            </p>
            {overrides.map((o, idx) => (
              <div key={idx} className="rounded-xl border border-black/[0.06] bg-white p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-[#1d1d1f] uppercase tracking-wider">
                    Metric: {o.metricKey}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-[#248A3D] border border-emerald-500/20 font-mono">
                    {o.oldScore} / 10 → {o.newScore} / 10
                  </span>
                </div>
                <p className="text-xs text-[#3a3a3c]">
                  <span className="font-semibold">{o.author}:</span> {o.reason}
                </p>
              </div>
            ))}
          </div>
        )}

        {tab === "deals" && (
          <div className="rounded-xl border border-black/[0.06] bg-white p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-[#1d1d1f]">{callCompany} Expansion</h4>
                <p className="text-xs text-[#6e6e73]">Stage: Qualified Discovery · Owner: {repName}</p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-[#007AFF] border border-blue-500/20">
                <Check className="h-3 w-3" /> Synced to CRM
              </span>
            </div>
            <p className="text-xs text-[#3a3a3c] leading-relaxed">
              This call is linked to the active deal in your CRM pipeline. Call evaluations, transcript snippets, and next steps write back automatically.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

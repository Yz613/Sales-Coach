"use client";

import { useState } from "react";
import { GraduationCap, CheckCircle2, Loader2, Send } from "lucide-react";
import { apiPath } from "@/lib/utils";

export default function TeachCoach({ callId }: { callId: string }) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!text.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(apiPath("/api/coach/lessons"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), sourceCallId: callId }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to save");
      setText("");
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch (err: any) {
      setError(err.message || "Failed to save lesson");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-blue-500/25 bg-blue-500/[0.05] p-6 sm:p-7 space-y-3.5 shadow-lg">
      <div className="flex items-center gap-2 text-[#007AFF] font-bold text-xs uppercase tracking-wider">
        <GraduationCap className="h-4 w-4" /> Teach the Coach
      </div>
      <h2 className="text-lg font-bold text-[#1d1d1f] tracking-tight">What should the rep have done differently?</h2>
      <p className="text-xs text-[#6e6e73]">
        Type the lesson from this call. It's saved to your coach and applied to every future evaluation.
      </p>

      <textarea
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="e.g. When the prospect said they were busy, he should have asked for 30 seconds and led with the ROI stat instead of offering to call back."
        className="w-full rounded-xl border border-black/[0.08] glass-inset p-3.5 text-sm text-[#1d1d1f] placeholder:text-[#86868b] leading-relaxed focus:border-blue-500 focus:outline-none transition"
      />

      {error && <p className="text-xs font-medium text-[#D70015]">{error}</p>}

      <div className="flex items-center justify-end gap-3">
        {saved && (
          <span className="flex items-center gap-1.5 text-xs text-[#248A3D]">
            <CheckCircle2 className="h-4 w-4" /> Lesson added to your coach
          </span>
        )}
        <button
          onClick={submit}
          disabled={saving || !text.trim()}
          className="flex items-center gap-2 rounded-xl bg-[#007AFF] hover:bg-[#0071E3] border border-black/10 px-5 py-2 text-xs font-semibold text-white shadow-md transition disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Teach Coach
        </button>
      </div>
    </div>
  );
}

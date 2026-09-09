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
    <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-6 space-y-3">
      <div className="flex items-center gap-2 text-blue-400 font-bold text-xs uppercase tracking-wider">
        <GraduationCap className="h-4 w-4" /> Teach the Coach
      </div>
      <h2 className="text-lg font-bold text-white">What should the rep have done differently?</h2>
      <p className="text-xs text-slate-400">
        Type the lesson from this call. It's saved to your coach and applied to every future evaluation.
      </p>

      <textarea
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="e.g. When the prospect said they were busy, he should have asked for 30 seconds and led with the ROI stat instead of offering to call back."
        className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-slate-200 placeholder-slate-600 leading-relaxed focus:border-blue-500 focus:outline-none"
      />

      {error && <p className="text-xs text-rose-400">{error}</p>}

      <div className="flex items-center justify-end gap-3">
        {saved && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-400">
            <CheckCircle2 className="h-4 w-4" /> Lesson added to your coach
          </span>
        )}
        <button
          onClick={submit}
          disabled={saving || !text.trim()}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Teach Coach
        </button>
      </div>
    </div>
  );
}

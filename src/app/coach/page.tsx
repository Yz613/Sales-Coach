"use client";

import { useState, useEffect } from "react";
import { GraduationCap, Sparkles, Plus, Trash2, CheckCircle2, Loader2, Lightbulb } from "lucide-react";
import { apiPath } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import type { CoachLesson } from "@/types";

export default function CoachPage() {
  const [instructions, setInstructions] = useState("");
  const [lessons, setLessons] = useState<CoachLesson[]>([]);
  const [newLesson, setNewLesson] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingInstructions, setSavingInstructions] = useState(false);
  const [savedInstructions, setSavedInstructions] = useState(false);
  const [addingLesson, setAddingLesson] = useState(false);

  const load = () => {
    fetch(apiPath("/api/coach"))
      .then((res) => res.json())
      .then((data) => {
        setInstructions(data.instructions || "");
        setLessons(Array.isArray(data.lessons) ? data.lessons : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    load();
  }, []);

  const saveInstructions = async () => {
    setSavingInstructions(true);
    setSavedInstructions(false);
    try {
      await fetch(apiPath("/api/coach"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instructions }),
      });
      setSavedInstructions(true);
      setTimeout(() => setSavedInstructions(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingInstructions(false);
    }
  };

  const addLesson = async () => {
    if (!newLesson.trim()) return;
    setAddingLesson(true);
    try {
      const res = await fetch(apiPath("/api/coach/lessons"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newLesson.trim() }),
      });
      const data = await res.json();
      if (data.lesson) {
        setLessons((prev) => [data.lesson, ...prev]);
        setNewLesson("");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAddingLesson(false);
    }
  };

  const deleteLesson = async (id: string) => {
    setLessons((prev) => prev.filter((l) => l.id !== id));
    try {
      await fetch(apiPath("/api/coach/lessons"), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch (err) {
      console.error(err);
      load();
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading your coach…
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="border-b border-slate-800 pb-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="rounded bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-blue-400 border border-blue-500/20">
            Build Your Coach
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-blue-400" /> Your AI Sales Coach
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Teach the coach in your exact image. Everything here is applied to every call the AI evaluates.
        </p>
      </div>

      {/* Coaching philosophy */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <Sparkles className="h-5 w-5 text-blue-400" />
          <div>
            <h2 className="text-base font-bold text-white">Coaching Philosophy — What Matters</h2>
            <p className="text-xs text-slate-400">
              Describe how you coach: what great looks like, what you care about, your tone, non-negotiables, and what to flag. Write it like you're briefing a new manager.
            </p>
          </div>
        </div>

        <textarea
          rows={10}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder={`e.g.\n- I care most about whether the rep earned the right to the next step.\n- Never let a rep accept "send me an email" without one strong pivot.\n- Budget must be discussed before any demo.\n- Reward reps who stay calm and ask a sharp follow-up under pressure.\n- Tone: direct, tactical, no fluff.`}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3.5 text-sm text-slate-200 placeholder-slate-600 leading-relaxed focus:border-blue-500 focus:outline-none"
        />

        <div className="flex items-center justify-end gap-3">
          {savedInstructions && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> Saved — applies to new evaluations
            </span>
          )}
          <button
            onClick={saveInstructions}
            disabled={savingInstructions}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-blue-500 transition disabled:opacity-50"
          >
            {savingInstructions ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Save Philosophy
          </button>
        </div>
      </div>

      {/* Lessons */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <Lightbulb className="h-5 w-5 text-amber-400" />
          <div>
            <h2 className="text-base font-bold text-white">Lessons You've Taught</h2>
            <p className="text-xs text-slate-400">
              Short, specific rules the coach applies to every call. You can also add these directly from any call ("Teach the coach").
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <input
            type="text"
            value={newLesson}
            onChange={(e) => setNewLesson(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addLesson();
            }}
            placeholder="e.g. If the prospect names a competitor, always ask what they'd improve before pitching."
            className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={addLesson}
            disabled={addingLesson || !newLesson.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-500 transition disabled:opacity-50"
          >
            {addingLesson ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Add Lesson
          </button>
        </div>

        {lessons.length === 0 ? (
          <p className="text-sm text-slate-500 italic py-4 text-center">
            No lessons yet. Add your first rule above, or teach the coach from a specific call.
          </p>
        ) : (
          <div className="space-y-2">
            {lessons.map((l) => (
              <div
                key={l.id}
                className="group flex items-start justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950 p-3.5"
              >
                <div className="flex items-start gap-2.5">
                  <Lightbulb className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm text-slate-200 leading-relaxed">{l.text}</p>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 mt-1 font-mono">
                      {formatDate(l.createdAt)}
                      {l.sourceCallId ? " • taught from a call" : ""}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => deleteLesson(l.id)}
                  className="shrink-0 rounded-md p-1.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 transition"
                  title="Remove lesson"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { GraduationCap, Sparkles, Plus, Trash2, CheckCircle2, Loader2, Lightbulb, ArrowRight, Pencil } from "lucide-react";
import { apiPath, formatDate } from "@/lib/utils";
import type { CoachLesson } from "@/types";

type View = "loading" | "onboarding" | "editor";

const QUESTIONS: { key: string; label: string; hint: string; placeholder: string; big?: boolean }[] = [
  {
    key: "greatCall",
    label: "What does a great call look like to you?",
    hint: "The behaviors and outcomes you want to see every time.",
    placeholder: "e.g. The rep controls the conversation, uncovers real pain, and earns a clear next step.",
    big: true,
  },
  {
    key: "mistakes",
    label: "What mistakes should the coach always catch?",
    hint: "The failure modes that cost you deals.",
    placeholder: "e.g. Folding on 'send me an email', pitching before qualifying, skipping budget.",
    big: true,
  },
  {
    key: "nonNegotiables",
    label: "What are your non-negotiables on every call?",
    hint: "Rules a rep must never break.",
    placeholder: "e.g. Always confirm budget before a demo. Always get a firm next step on the calendar.",
    big: true,
  },
  {
    key: "methodology",
    label: "What methodology or framework do you run?",
    hint: "Optional — name it or describe your own.",
    placeholder: "e.g. Sandler, MEDDIC, Challenger, or your own playbook",
  },
  {
    key: "outcomes",
    label: "What outcomes matter most?",
    hint: "What you optimize for.",
    placeholder: "e.g. Booked qualified meetings, multithreading to the economic buyer",
  },
  {
    key: "tone",
    label: "How should the coach talk to reps?",
    hint: "The coaching voice.",
    placeholder: "e.g. Direct and tactical, no fluff — but constructive",
  },
];

function composeInstructions(answers: Record<string, string>): string {
  const blocks: string[] = [];
  if (answers.greatCall?.trim()) blocks.push(`What a great call looks like:\n${answers.greatCall.trim()}`);
  if (answers.mistakes?.trim()) blocks.push(`Mistakes to always catch:\n${answers.mistakes.trim()}`);
  if (answers.nonNegotiables?.trim()) blocks.push(`Non-negotiables on every call:\n${answers.nonNegotiables.trim()}`);
  if (answers.methodology?.trim()) blocks.push(`Methodology / framework: ${answers.methodology.trim()}`);
  if (answers.outcomes?.trim()) blocks.push(`Outcomes that matter most: ${answers.outcomes.trim()}`);
  if (answers.tone?.trim()) blocks.push(`Coaching tone: ${answers.tone.trim()}`);
  return blocks.join("\n\n");
}

export default function CoachPage() {
  const [view, setView] = useState<View>("loading");
  const [instructions, setInstructions] = useState("");
  const [lessons, setLessons] = useState<CoachLesson[]>([]);
  const [newLesson, setNewLesson] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [savingInstructions, setSavingInstructions] = useState(false);
  const [savedInstructions, setSavedInstructions] = useState(false);
  const [building, setBuilding] = useState(false);
  const [addingLesson, setAddingLesson] = useState(false);

  const load = () => {
    fetch(apiPath("/api/coach"))
      .then((res) => res.json())
      .then((data) => {
        const instr = data.instructions || "";
        setInstructions(instr);
        setLessons(Array.isArray(data.lessons) ? data.lessons : []);
        setView(instr.trim() ? "editor" : "onboarding");
      })
      .catch((err) => {
        console.error(err);
        setView("editor");
      });
  };

  useEffect(() => {
    load();
  }, []);

  const saveInstructions = async (text: string) => {
    await fetch(apiPath("/api/coach"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instructions: text }),
    });
  };

  const buildFromQuestions = async () => {
    const composed = composeInstructions(answers);
    if (!composed.trim()) return;
    setBuilding(true);
    try {
      await saveInstructions(composed);
      setInstructions(composed);
      setView("editor");
    } catch (err) {
      console.error(err);
    } finally {
      setBuilding(false);
    }
  };

  const handleSaveInstructions = async () => {
    setSavingInstructions(true);
    setSavedInstructions(false);
    try {
      await saveInstructions(instructions);
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

  if (view === "loading") {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading your coach…
      </div>
    );
  }

  const header = (
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
  );

  // ---- Onboarding questionnaire ----
  if (view === "onboarding") {
    const canBuild = composeInstructions(answers).trim().length > 0;
    return (
      <div className="max-w-3xl mx-auto space-y-8">
        {header}

        <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 text-sm text-slate-300">
          Answer these questions to build your initial coach. You can refine everything afterward and keep teaching it from individual calls.
        </div>

        <div className="space-y-6">
          {QUESTIONS.map((q, idx) => (
            <div key={q.key} className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 space-y-2">
              <label className="block">
                <span className="flex items-center gap-2 text-sm font-bold text-white">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/20 text-[11px] font-bold text-blue-400">
                    {idx + 1}
                  </span>
                  {q.label}
                </span>
                <span className="block text-xs text-slate-400 mt-0.5 ml-7">{q.hint}</span>
              </label>
              {q.big ? (
                <textarea
                  rows={3}
                  value={answers[q.key] || ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.key]: e.target.value }))}
                  placeholder={q.placeholder}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-slate-200 placeholder-slate-600 leading-relaxed focus:border-blue-500 focus:outline-none"
                />
              ) : (
                <input
                  type="text"
                  value={answers[q.key] || ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.key]: e.target.value }))}
                  placeholder={q.placeholder}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:border-blue-500 focus:outline-none"
                />
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => setView("editor")}
            className="text-xs font-semibold text-slate-400 hover:text-white transition"
          >
            Skip — write it freeform instead
          </button>
          <button
            onClick={buildFromQuestions}
            disabled={building || !canBuild}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow hover:bg-blue-500 transition disabled:opacity-50"
          >
            {building ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            Build my coach
          </button>
        </div>
      </div>
    );
  }

  // ---- Editor ----
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {header}

      {/* Coaching philosophy */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-6 space-y-4">
        <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-400" />
            <div>
              <h2 className="text-base font-bold text-white">Coaching Philosophy — What Matters</h2>
              <p className="text-xs text-slate-400">Applied to every call the AI evaluates.</p>
            </div>
          </div>
          <button
            onClick={() => {
              setAnswers({});
              setView("onboarding");
            }}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition"
          >
            <Pencil className="h-3.5 w-3.5" /> Rebuild from questions
          </button>
        </div>

        <textarea
          rows={12}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Describe how you coach: what great looks like, non-negotiables, tone, and what to flag."
          className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3.5 text-sm text-slate-200 placeholder-slate-600 leading-relaxed focus:border-blue-500 focus:outline-none"
        />

        <div className="flex items-center justify-end gap-3">
          {savedInstructions && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> Saved — applies to new evaluations
            </span>
          )}
          <button
            onClick={handleSaveInstructions}
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
              Short, specific rules the coach applies to every call. You can also add these from any call ("Teach the coach").
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

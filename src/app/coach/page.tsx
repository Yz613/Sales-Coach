"use client";

import { useState, useEffect } from "react";
import { GraduationCap, Sparkles, Plus, Trash2, CheckCircle2, Loader2, Lightbulb, ArrowRight, Pencil, RotateCcw } from "lucide-react";
import { apiPath, formatDate } from "@/lib/utils";
import type { CoachLesson } from "@/types";
import { DEFAULT_SANDLER_INSTRUCTIONS, SANDLER_ONBOARDING_ANSWERS } from "@/lib/sandlerCoach";
import type { MethodId } from "@/lib/methodology";
import { METHOD_CHOICES, checklistSections, methodById } from "@/lib/salesMethods";
import { MAX_METRIC_WEIGHT, metricsForMethod, weightShare, weightsAreCustom } from "@/lib/scoreWeights";

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
    placeholder: "e.g. Sandler Selling System (default) — tweak or replace",
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

function MethodologyProfile({
  methodId,
  weights,
  onWeight,
  onSave,
  saving,
  saved,
}: {
  methodId: MethodId;
  weights: Record<string, number>;
  onWeight: (key: string, value: number) => void;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
}) {
  const method = methodById(methodId);
  const metrics = metricsForMethod(method);
  const custom = weightsAreCustom(weights, method);
  return (
    <div className="rounded-2xl glass-card p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">Scoring profile — {method.name}</h2>
          <p className="text-xs text-slate-400 mt-1">
            {method.id === "sandler"
              ? "Sandler is selected. The narrative and the checklist below are the Sandler defaults."
              : `${method.name} is selected. The narrative and the checklist are the ${method.name} defaults. Sandler rules are off.`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {saved && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> Saved
            </span>
          )}
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-medium text-white shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500 transition disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Save weights
          </button>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Metric weights</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Admins set how much each metric the AI scores counts toward the call score. Each starts at 1.
              Call scores keep the current formula until you save a weight other than 1. After that, the score is the weighted average of these metrics. Zero leaves a metric out.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {metrics.map((metric) => {
            const weight = weights[metric.key] ?? 1;
            return (
              <label key={metric.key} className="flex items-center justify-between gap-3 rounded-xl glass-inset border border-white/[0.08] px-3 py-2.5">
                <span className="min-w-0">
                  <span className="block text-sm text-white truncate">{metric.label}</span>
                  <span className="block text-[10px] uppercase tracking-wider text-slate-500">
                    {custom ? `${weightShare(weights, method, metric.key)}% of the score` : "Even"}
                  </span>
                </span>
                <input
                  type="number"
                  min={0}
                  max={MAX_METRIC_WEIGHT}
                  step={1}
                  inputMode="numeric"
                  aria-label={`${metric.label} weight`}
                  value={weight}
                  onChange={(e) => {
                    const next = e.target.value === "" ? 0 : Number(e.target.value);
                    if (!Number.isFinite(next)) return;
                    onWeight(metric.key, Math.min(MAX_METRIC_WEIGHT, Math.max(0, Math.round(next))));
                  }}
                  className="w-16 rounded-lg border border-white/[0.1] bg-slate-950/50 px-2 py-1.5 text-right text-sm font-mono text-white focus:border-blue-500/50 focus:outline-none"
                />
              </label>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {method.pillars.map((pillar, index) => (
          <div key={pillar.key} className="rounded-xl glass-inset border border-white/[0.08] p-3.5 space-y-1">
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
              {index + 1}. {pillar.cardTitle}
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">{pillar.summary}</p>
          </div>
        ))}
      </div>
      {method.checklist || method.id === "sandler" ? (
        <div className="space-y-2">
          <p className="text-xs text-slate-300">
            {method.id === "sandler"
              ? "Sales Call Debrief and the skills sheet are scored on every Sandler call. Anything not done shows in red."
              : `Every ${method.name} call is scored on this checklist. Anything not done shows in red.`}
          </p>
          <div className="flex flex-wrap gap-2">
            {checklistSections(method).map((section) => (
              <span key={section.section} className="rounded-full border border-white/[0.1] bg-white/[0.04] px-2.5 py-1 text-[11px] text-slate-300">
                {section.section} · {section.count}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {method.microSkills.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {method.microSkills.map((skill) => (
            <span key={skill.key} className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-[11px] font-medium text-blue-200">
              {skill.label}
            </span>
          ))}
        </div>
      ) : null}
      <p className="text-xs text-slate-400">
        Coaching write-ups lead with {method.coaching.praiseLabel.toLowerCase()}, then {method.coaching.gapsLabel.toLowerCase()}, then {method.coaching.drillsLabel.toLowerCase()}.
      </p>
    </div>
  );
}

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
  const [answers, setAnswers] = useState<Record<string, string>>({ ...SANDLER_ONBOARDING_ANSWERS });
  const [savingInstructions, setSavingInstructions] = useState(false);
  const [savedInstructions, setSavedInstructions] = useState(false);
  const [building, setBuilding] = useState(false);
  const [addingLesson, setAddingLesson] = useState(false);
  const [isDefault, setIsDefault] = useState(true);
  const [methodId, setMethodId] = useState<MethodId>("sandler");
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [savingWeights, setSavingWeights] = useState(false);
  const [savedWeights, setSavedWeights] = useState(false);

  const load = () => {
    fetch(apiPath("/api/coach"))
      .then((res) => res.json())
      .then((data) => {
        const selected = (data.methodology || "sandler") as MethodId;
        const instr = data.instructions || methodById(selected).narrative || DEFAULT_SANDLER_INSTRUCTIONS;
        setMethodId(selected);
        setInstructions(instr);
        setIsDefault(Boolean(data.isDefault));
        setLessons(Array.isArray(data.lessons) ? data.lessons : []);
        setWeights(data.weights && typeof data.weights === "object" ? data.weights : {});
        setView("editor");
      })
      .catch((err) => {
        console.error(err);
        setView("editor");
      });
  };

  useEffect(() => {
    load();
  }, []);

  const saveInstructions = async (text: string, methodology: MethodId = methodId) => {
    await fetch(apiPath("/api/coach"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instructions: text, methodology }),
    });
  };

  const saveWeights = async () => {
    setSavingWeights(true);
    setSavedWeights(false);
    try {
      const res = await fetch(apiPath("/api/coach"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weights }),
      });
      const data = await res.json();
      if (data.weights && typeof data.weights === "object") setWeights(data.weights);
      setSavedWeights(true);
      setTimeout(() => setSavedWeights(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingWeights(false);
    }
  };

  const chooseMethod = async (next: MethodId) => {
    const narrative = methodById(next).narrative || DEFAULT_SANDLER_INSTRUCTIONS;
    setMethodId(next);
    setInstructions(narrative);
    setIsDefault(true);
    setSavingInstructions(true);
    try {
      await saveInstructions(narrative, next);
      setSavedInstructions(true);
      setTimeout(() => setSavedInstructions(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingInstructions(false);
    }
  };

  const buildFromQuestions = async () => {
    const composed = composeInstructions(answers);
    if (!composed.trim()) return;
    setBuilding(true);
    try {
      await saveInstructions(composed);
      setInstructions(composed);
      setIsDefault(false);
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
      setIsDefault(instructions.trim() === (methodById(methodId).narrative || "").trim() || !instructions.trim());
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
    <div className="border-b border-white/[0.08] pb-5">
      <div className="flex items-center gap-2 mb-2">
        <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-blue-400 border border-blue-500/20">
          {isDefault ? `Default: ${methodById(methodId).name}` : methodById(methodId).name}
        </span>
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
          <GraduationCap className="h-5 w-5" />
        </div>
        Your AI Sales Coach
      </h1>
      <p className="text-xs text-slate-400 mt-1.5">
        Starts as Sandler. Tweak the philosophy below — every evaluation uses what you save here.
      </p>
    </div>
  );

  // ---- Onboarding questionnaire ----
  if (view === "onboarding") {
    const canBuild = composeInstructions(answers).trim().length > 0;
    return (
      <div className="max-w-3xl mx-auto space-y-8">
        {header}

        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.06] backdrop-blur-xl p-4 text-xs text-blue-200/90">
          Pre-filled with Sandler Selling System. Edit any answer, then build — you can keep tweaking the full philosophy afterward.
        </div>

        <div className="space-y-6">
          {QUESTIONS.map((q, idx) => (
            <div key={q.key} className="rounded-2xl glass-card p-5 space-y-2">
              <label className="block">
                <span className="flex items-center gap-2 text-sm font-semibold text-white">
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
                  className="w-full rounded-xl glass-inset border border-white/[0.08] p-3 text-xs text-slate-200 placeholder-slate-500 leading-relaxed focus:border-blue-500/50 focus:outline-none"
                />
              ) : (
                <input
                  type="text"
                  value={answers[q.key] || ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.key]: e.target.value }))}
                  placeholder={q.placeholder}
                  className="w-full rounded-xl glass-inset border border-white/[0.08] px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:border-blue-500/50 focus:outline-none"
                />
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => setView("editor")}
            className="text-xs font-medium text-slate-400 hover:text-white transition"
          >
            Skip — write it freeform instead
          </button>
          <button
            onClick={buildFromQuestions}
            disabled={building || !canBuild}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-2.5 text-xs font-medium text-white shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500 transition disabled:opacity-50"
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

      <div className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.06] backdrop-blur-xl p-4 text-xs text-blue-200/90">
        {isDefault
          ? "This coach defaults to the Sandler Selling System (Up-Front Contract, Pain Funnel, Budget, Decision, then Fulfillment). Edit the philosophy and save to make it yours."
          : "You're running a customized coach. Reset to Sandler anytime, or keep teaching it with lessons from individual calls."}
      </div>

      <div className="rounded-2xl glass-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Sales method</h2>
          <p className="text-xs text-slate-400 mt-1">Choosing one loads that method&apos;s narrative and checklist.</p>
        </div>
        <select
          value={methodId}
          onChange={(e) => chooseMethod(e.target.value as MethodId)}
          className="rounded-xl glass-inset border border-white/[0.08] bg-slate-900 px-3.5 py-2.5 text-sm text-white focus:border-blue-500/50 focus:outline-none"
        >
          {METHOD_CHOICES.map((choice) => (
            <option key={choice.id} value={choice.id}>{choice.name}</option>
          ))}
        </select>
      </div>

      <MethodologyProfile
        methodId={methodId}
        weights={weights}
        onWeight={(key, value) => setWeights((current) => ({ ...current, [key]: value }))}
        onSave={saveWeights}
        saving={savingWeights}
        saved={savedWeights}
      />

      {/* Coaching philosophy */}
      <div className="rounded-2xl glass-card p-6 space-y-5">
        <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Coaching Philosophy — What Matters</h2>
              <p className="text-xs text-slate-400">Applied to every call the AI evaluates.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isDefault && (
              <button
                onClick={() => chooseMethod(methodId)}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/[0.08] hover:text-white transition"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset narrative
              </button>
            )}
            <button
              onClick={() => {
                setAnswers({ ...SANDLER_ONBOARDING_ANSWERS });
                setView("onboarding");
              }}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/[0.08] hover:text-white transition"
            >
              <Pencil className="h-3.5 w-3.5" /> Rebuild from questions
            </button>
          </div>
        </div>

        <textarea
          rows={16}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Describe how you coach: what great looks like, non-negotiables, tone, and what to flag."
          className="w-full rounded-xl glass-inset border border-white/[0.08] p-4 text-xs text-slate-200 placeholder-slate-500 leading-relaxed font-mono focus:border-blue-500/50 focus:outline-none"
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
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-xs font-medium text-white shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500 transition disabled:opacity-50"
          >
            {savingInstructions ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Save Philosophy
          </button>
        </div>
      </div>

      {/* Lessons */}
      <div className="rounded-2xl glass-card p-6 space-y-5">
        <div className="flex items-center gap-3 border-b border-white/[0.08] pb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Lightbulb className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Lessons You've Taught</h2>
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
            className="flex-1 rounded-xl glass-inset border border-white/[0.08] px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-blue-500/50 focus:outline-none"
          />
          <button
            onClick={addLesson}
            disabled={addingLesson || !newLesson.trim()}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-xs font-medium text-white shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500 transition disabled:opacity-50"
          >
            {addingLesson ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Add Lesson
          </button>
        </div>

        {lessons.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-4 text-center">
            No lessons yet. Add your first rule above, or teach the coach from a specific call.
          </p>
        ) : (
          <div className="space-y-2">
            {lessons.map((l) => (
              <div
                key={l.id}
                className="group flex items-start justify-between gap-3 rounded-xl glass-inset border border-white/[0.08] p-3.5"
              >
                <div className="flex items-start gap-2.5">
                  <Lightbulb className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-slate-200 leading-relaxed">{l.text}</p>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 mt-1 font-mono">
                      {formatDate(l.createdAt)}
                      {l.sourceCallId ? " • taught from a call" : ""}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => deleteLesson(l.id)}
                  className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 transition"
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

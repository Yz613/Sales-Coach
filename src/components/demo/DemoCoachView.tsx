"use client";

import { useState } from "react";
import { GraduationCap, Sparkles, CheckCircle2, Sliders, BookOpen, Lightbulb } from "lucide-react";
import { DEMO_COACH } from "@/lib/demo/workspace";

const TONES = [
  "Direct and tactical",
  "Analytical and specific",
  "Encouraging and clear",
  "Tough love",
];

const METHODOLOGIES = [
  "Sandler Selling System",
  "MEDDIC / MEDDPICC",
  "SPICED Framework",
  "Challenger Sale",
];

export default function DemoCoachView() {
  const [instructions, setInstructions] = useState(DEMO_COACH.instructions);
  const [tone, setTone] = useState(DEMO_COACH.tone);
  const [method, setMethod] = useState(DEMO_COACH.methodology);
  const [weights, setWeights] = useState(DEMO_COACH.weights);

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-[#1d1d1f]">AI Sales Coach Configuration</h2>
        <p className="text-xs text-[#6e6e73] mt-0.5">
          Train the coach on your specific management style, non-negotiables, scoring weights, and framework rules.
        </p>
      </div>

      {/* 1. Coach Instructions */}
      <div className="rounded-2xl glass-card p-6 space-y-4 border border-black/[0.08]">
        <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-[#007AFF]" />
            <h3 className="text-sm font-bold text-[#1d1d1f]">Manager Coaching Directive</h3>
          </div>
          <span className="text-[10px] font-semibold text-[#86868b] uppercase">Custom Playbook Rules</span>
        </div>

        <div className="space-y-2">
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={4}
            className="w-full rounded-xl bg-white border border-black/[0.08] p-3.5 text-xs text-[#1d1d1f] leading-relaxed focus:border-blue-500 focus:outline-none shadow-xs"
          />
          <p className="text-[11px] text-[#86868b]">
            The AI Sales Manager uses these instructions to tailor praise, tactical gaps, and objection audits across all calls.
          </p>
        </div>
      </div>

      {/* 2. Tone & Methodology Pickers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-2xl glass-card p-6 space-y-3 border border-black/[0.08]">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#1d1d1f]">Coaching Tone</h3>
          <p className="text-[11px] text-[#6e6e73]">How direct and rigorous the feedback should sound to reps.</p>
          <div className="grid grid-cols-2 gap-2 pt-1">
            {TONES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTone(t)}
                className={`rounded-xl px-3 py-2 text-xs font-semibold text-left transition border ${
                  tone === t
                    ? "bg-[#007AFF] text-white border-[#007AFF] shadow-xs"
                    : "bg-white text-[#3a3a3c] border-black/[0.08] hover:bg-black/[0.02]"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl glass-card p-6 space-y-3 border border-black/[0.08]">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#1d1d1f]">Sales Methodology</h3>
          <p className="text-[11px] text-[#6e6e73]">The core qualification framework used to score calls.</p>
          <div className="grid grid-cols-2 gap-2 pt-1">
            {METHODOLOGIES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={`rounded-xl px-3 py-2 text-xs font-semibold text-left transition border ${
                  method === m
                    ? "bg-[#007AFF] text-white border-[#007AFF] shadow-xs"
                    : "bg-white text-[#3a3a3c] border-black/[0.08] hover:bg-black/[0.02]"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Metric Weights Sliders */}
      <div className="rounded-2xl glass-card p-6 space-y-4 border border-black/[0.08]">
        <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-[#007AFF]" />
            <h3 className="text-sm font-bold text-[#1d1d1f]">Scorecard Weighting Sliders</h3>
          </div>
          <span className="text-[11px] font-mono text-[#86868b]">
            Total: {weights.pain + weights.budget + weights.decision + weights.nextStep}%
          </span>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-xs font-semibold mb-1">
              <span>Pain Qualification Weight</span>
              <span className="font-mono text-[#007AFF]">{weights.pain}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="50"
              value={weights.pain}
              onChange={(e) => setWeights({ ...weights, pain: Number(e.target.value) })}
              className="w-full accent-[#007AFF]"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-semibold mb-1">
              <span>Budget Qualification Weight</span>
              <span className="font-mono text-[#248A3D]">{weights.budget}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="50"
              value={weights.budget}
              onChange={(e) => setWeights({ ...weights, budget: Number(e.target.value) })}
              className="w-full accent-[#248A3D]"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-semibold mb-1">
              <span>Decision Authority Weight</span>
              <span className="font-mono text-[#FF9500]">{weights.decision}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="50"
              value={weights.decision}
              onChange={(e) => setWeights({ ...weights, decision: Number(e.target.value) })}
              className="w-full accent-[#FF9500]"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-semibold mb-1">
              <span>Next Step Execution Weight</span>
              <span className="font-mono text-[#C45500]">{weights.nextStep}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="50"
              value={weights.nextStep}
              onChange={(e) => setWeights({ ...weights, nextStep: Number(e.target.value) })}
              className="w-full accent-[#C45500]"
            />
          </div>
        </div>
      </div>

      {/* 4. Non-Negotiables & Learned Lessons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-2xl glass-card p-6 space-y-3 border border-black/[0.08]">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#1d1d1f] flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-[#248A3D]" /> Manager Non-Negotiables
          </h3>
          <ul className="space-y-2 text-xs text-[#3a3a3c]">
            {DEMO_COACH.nonNegotiables.map((rule, idx) => (
              <li key={idx} className="flex items-start gap-2 bg-emerald-500/[0.04] p-2.5 rounded-xl border border-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-[#248A3D] mt-1.5 shrink-0" />
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl glass-card p-6 space-y-3 border border-black/[0.08]">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#1d1d1f] flex items-center gap-1.5">
            <Lightbulb className="h-4 w-4 text-[#FF9500]" /> Learned Call Lessons
          </h3>
          <ul className="space-y-2 text-xs text-[#3a3a3c]">
            {DEMO_COACH.lessons.map((lesson) => (
              <li key={lesson.id} className="rounded-xl border border-black/[0.06] bg-white p-3 space-y-1">
                <p className="text-[11px] text-[#1d1d1f] leading-snug">{lesson.text}</p>
                <div className="flex justify-between text-[10px] text-[#86868b] pt-1">
                  <span>Source: {lesson.sourceCall}</span>
                  <span>{lesson.createdAt}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

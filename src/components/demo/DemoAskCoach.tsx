"use client";

import { useState } from "react";
import { MessageSquare, Sparkles, Send, Bot } from "lucide-react";

export default function DemoAskCoach({
  callCompany,
  demoAnswers,
}: {
  callCompany: string;
  demoAnswers: Record<string, string>;
}) {
  const defaultQuestions = Object.keys(demoAnswers);
  const [selectedQuestion, setSelectedQuestion] = useState<string>(defaultQuestions[0] || "");
  const [customInput, setCustomInput] = useState("");
  const [response, setResponse] = useState<string>(
    defaultQuestions[0] ? demoAnswers[defaultQuestions[0]] : ""
  );

  const handleAsk = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setSelectedQuestion(trimmed);
    if (demoAnswers[trimmed]) {
      setResponse(demoAnswers[trimmed]);
    } else {
      // Find closest or provide tailored coach response
      const matched = Object.entries(demoAnswers).find(([k]) =>
        trimmed.toLowerCase().includes(k.toLowerCase().slice(0, 10))
      );
      if (matched) {
        setResponse(matched[1]);
      } else {
        setResponse(
          `Sales Coach AI Evaluation: On this call with ${callCompany}, the key coaching focus is staying anchored on customer pain and refusing early brush-offs. Maintain an up-front contract, verify budget thresholds before showing software, and lock firm calendar time with economic buyers.`
        );
      }
    }
    setCustomInput("");
  };

  return (
    <div className="rounded-2xl glass-card p-6 space-y-4 border border-blue-500/20 bg-blue-500/[0.03]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#007AFF] text-white shadow-xs">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#1d1d1f]">Ask AI Sales Coach</h3>
            <p className="text-xs text-[#6e6e73]">Ask questions about objections, rep posture, or manager talk tracks on this call.</p>
          </div>
        </div>
        <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#007AFF] border border-blue-500/20">
          Interactive AI Demo
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {defaultQuestions.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => handleAsk(q)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              selectedQuestion === q
                ? "bg-[#007AFF] text-white shadow-xs"
                : "bg-white text-[#3a3a3c] border border-black/[0.08] hover:bg-black/[0.03]"
            }`}
          >
            <Sparkles className="inline-block h-3 w-3 mr-1" />
            {q}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleAsk(customInput);
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          placeholder={`Ask anything about this call with ${callCompany}...`}
          className="flex-1 rounded-xl bg-white border border-black/[0.08] px-3.5 py-2 text-xs text-[#1d1d1f] placeholder:text-[#86868b] focus:border-blue-500 focus:outline-none shadow-xs"
        />
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#007AFF] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0071E3] transition shadow-xs"
        >
          <Send className="h-3 w-3" /> Ask Coach
        </button>
      </form>

      {response && (
        <div className="rounded-xl border border-black/[0.06] bg-white p-4 space-y-1.5 shadow-xs">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#007AFF]">
            <MessageSquare className="h-3.5 w-3.5" />
            <span>AI Manager Assessment</span>
          </div>
          <p className="text-xs text-[#3a3a3c] leading-relaxed">{response}</p>
        </div>
      )}
    </div>
  );
}

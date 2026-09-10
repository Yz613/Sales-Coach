"use client";

import { useEffect, useState } from "react";
import { CUSTOM_STAGE_VALUE, normalizeStageName } from "@/lib/callStages";

interface CallStageSelectProps {
  value: string;
  stages: string[];
  onChange: (stage: string) => void;
  label?: string;
  hint?: string;
}

export default function CallStageSelect({
  value,
  stages,
  onChange,
  label = "Call Stage Target",
  hint,
}: CallStageSelectProps) {
  const known = stages.some((s) => s.toLowerCase() === (value || "").trim().toLowerCase());
  const [mode, setMode] = useState<"list" | "custom">(known || !value ? "list" : "custom");
  const [customName, setCustomName] = useState(known ? "" : value);

  useEffect(() => {
    const isKnown = stages.some((s) => s.toLowerCase() === (value || "").trim().toLowerCase());
    if (isKnown) {
      setMode("list");
    } else if (value) {
      setMode("custom");
      setCustomName(value);
    }
  }, [value, stages]);

  const selectValue = mode === "custom" ? CUSTOM_STAGE_VALUE : value;

  return (
    <div>
      <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-1.5">
        {label}
      </label>
      {hint && <p className="text-xs text-slate-400 mb-2">{hint}</p>}
      <select
        value={selectValue}
        onChange={(e) => {
          if (e.target.value === CUSTOM_STAGE_VALUE) {
            setMode("custom");
            setCustomName("");
            onChange("");
            return;
          }
          setMode("list");
          onChange(e.target.value);
        }}
        className="w-full rounded-xl glass-inset border border-white/[0.08] px-3.5 py-2.5 text-xs text-white focus:border-blue-500/50 focus:outline-none"
      >
        {stages.map((stage) => (
          <option key={stage} value={stage}>
            {stage}
          </option>
        ))}
        <option value={CUSTOM_STAGE_VALUE}>＋ Custom / new Call Stage Target…</option>
      </select>
      {mode === "custom" && (
        <input
          type="text"
          autoFocus
          value={customName}
          onChange={(e) => {
            const next = e.target.value;
            setCustomName(next);
            onChange(normalizeStageName(next));
          }}
          placeholder="e.g. Demo, Renewal, Executive Briefing"
          className="mt-2 w-full rounded-xl glass-inset border border-blue-500/30 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-blue-500/60 focus:outline-none"
        />
      )}
    </div>
  );
}

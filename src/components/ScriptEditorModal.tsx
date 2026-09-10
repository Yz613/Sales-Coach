"use client";

import { useState, useEffect } from "react";
import { X, Plus, Trash2, CheckCircle2, Loader2, BookOpen } from "lucide-react";
import { apiPath } from "@/lib/utils";
import type { SalesScript } from "@/types";
import { DEFAULT_CALL_STAGES } from "@/lib/callStages";
import CallStageSelect from "@/components/CallStageSelect";

interface ScriptEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  scriptToEdit?: SalesScript | null;
  onSaved: () => void;
  stages?: string[];
  initialStage?: string;
}

export default function ScriptEditorModal({
  isOpen,
  onClose,
  scriptToEdit,
  onSaved,
  stages,
  initialStage,
}: ScriptEditorModalProps) {
  const stageOptions = stages && stages.length > 0 ? stages : [...DEFAULT_CALL_STAGES];
  const defaultStage = initialStage || stageOptions[0] || "Cold Call";
  const [stage, setStage] = useState(defaultStage);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [milestones, setMilestones] = useState<string[]>([""]);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (scriptToEdit) {
      setStage(scriptToEdit.stage);
      setTitle(scriptToEdit.title);
      setContent(scriptToEdit.content);
      setMilestones(scriptToEdit.keyMilestones.length ? scriptToEdit.keyMilestones : [""]);
      setIsActive(scriptToEdit.isActive);
    } else {
      setStage(initialStage || stageOptions[0] || "Cold Call");
      setTitle("");
      setContent("");
      setMilestones([""]);
      setIsActive(true);
    }
    setError(null);
  }, [scriptToEdit, isOpen, initialStage]);

  if (!isOpen) return null;

  const handleAddMilestone = () => {
    setMilestones([...milestones, ""]);
  };

  const handleMilestoneChange = (index: number, val: string) => {
    const updated = [...milestones];
    updated[index] = val;
    setMilestones(updated);
  };

  const handleRemoveMilestone = (index: number) => {
    setMilestones(milestones.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setError("Please provide a title and script content.");
      return;
    }
    if (!stage.trim()) {
      setError("Please choose a Call Stage Target or type a new one.");
      return;
    }

    setSaving(true);
    setError(null);

    const cleanedMilestones = milestones.map((m) => m.trim()).filter(Boolean);

    try {
      const res = await fetch(apiPath("/api/admin/scripts"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: scriptToEdit?.id,
          stage,
          title: title.trim(),
          content: content.trim(),
          keyMilestones: cleanedMilestones,
          isActive,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save script");
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save script");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
      <div className="relative w-full max-w-3xl rounded-3xl glass-panel border border-white/[0.1] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-4 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <BookOpen className="h-5 w-5" />
            </div>
            <h2 className="text-base font-semibold text-white">
              {scriptToEdit ? "Edit Prescribed Playbook" : "Upload New Sales Script & Milestones"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <CallStageSelect
              value={stage}
              stages={stageOptions.includes(stage) || !stage ? stageOptions : [...stageOptions, stage]}
              onChange={setStage}
              hint="Pick an existing type or add a new Call Stage Target (e.g. Demo, Renewal)."
            />

            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-1.5">
                Script / Playbook Title
              </label>
              <input
                type="text"
                placeholder="e.g. Standard Pattern Interrupt & Disarm Playbook"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl glass-inset border border-white/[0.08] px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-blue-500/50 focus:outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-1">
              Required Milestones for Adherence Scoring
            </label>
            <p className="text-xs text-slate-400 mb-2">
              The AI Coach verifies whether reps hit each milestone in the transcript to calculate script adherence.
            </p>
            <div className="space-y-2">
              {milestones.map((m, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/[0.06] text-[10px] font-mono text-slate-400">
                    {idx + 1}
                  </span>
                  <input
                    type="text"
                    placeholder="e.g. Disarm with 30-second permission within first 20s"
                    value={m}
                    onChange={(e) => handleMilestoneChange(idx, e.target.value)}
                    className="flex-1 rounded-xl glass-inset border border-white/[0.08] px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-blue-500/50 focus:outline-none"
                  />
                  {milestones.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMilestone(idx)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={handleAddMilestone}
                className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 mt-1.5"
              >
                <Plus className="h-3.5 w-3.5" /> Add Milestone Checkpoint
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-1.5">
              Script Content & Objection Response Guidelines
            </label>
            <textarea
              rows={8}
              placeholder={`Rep Opening:\n"Hey [Name], [Rep] here with [Company]. I know you weren't expecting my call, do you have 30 seconds...?"\n\nWhen Prospect says: "We already have a vendor"\nPivot: "Totally get that..."`}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full rounded-xl glass-inset border border-white/[0.08] p-3.5 font-mono text-xs text-slate-200 placeholder-slate-500 focus:border-blue-500/50 focus:outline-none"
              required
            />
          </div>

          <div className="flex items-center gap-2.5 pt-1">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-white/[0.1] bg-white/[0.04] text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="isActive" className="text-xs text-slate-300 font-medium">
              Set as Active Prescribed Script for this stage (Calls in this stage will be benchmarked against this script)
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-white/[0.08] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-medium text-slate-400 hover:bg-white/[0.06] hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-xs font-medium text-white shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500 transition disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Save Prescribed Playbook
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

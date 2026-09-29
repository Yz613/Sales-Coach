"use client";

import { useState, useEffect } from "react";
import { X, UserCheck, CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react";
import { apiPath } from "@/lib/utils";
import type { RepPersona } from "@/types";

interface PersonaModalProps {
  isOpen: boolean;
  onClose: () => void;
  repId: string;
  repName: string;
  onSaved: () => void;
}

export default function PersonaModal({
  isOpen,
  onClose,
  repId,
  repName,
  onSaved,
}: PersonaModalProps) {
  const [experienceLevel, setExperienceLevel] = useState("Ramping AE");
  const [coachingTone, setCoachingTone] = useState("Tough Love / Direct VP");
  const [blindspots, setBlindspots] = useState<string[]>([]);
  const [newBlindspot, setNewBlindspot] = useState("");
  const [strengths, setStrengths] = useState<string[]>([]);
  const [newStrength, setNewStrength] = useState("");
  const [managerNotes, setManagerNotes] = useState("");
  const [targetQuota, setTargetQuota] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && repId) {
      setLoading(true);
      fetch(apiPath(`/api/reps/${repId}/persona`))
        .then((res) => res.json())
        .then((data: RepPersona) => {
          if (data) {
            setExperienceLevel(data.experienceLevel || "Ramping AE");
            setCoachingTone(data.coachingTone || "Tough Love / Direct VP");
            setBlindspots(data.knownBlindspots || []);
            setStrengths(data.strengths || []);
            setManagerNotes(data.managerNotes || "");
            setTargetQuota(data.targetQuota || "");
          }
          setLoading(false);
        })
        .catch((err) => {
          console.error(err);
          setLoading(false);
        });
    }
  }, [isOpen, repId]);

  if (!isOpen) return null;

  const handleAddBlindspot = () => {
    if (newBlindspot.trim() && !blindspots.includes(newBlindspot.trim())) {
      setBlindspots([...blindspots, newBlindspot.trim()]);
      setNewBlindspot("");
    }
  };

  const handleRemoveBlindspot = (item: string) => {
    setBlindspots(blindspots.filter((b) => b !== item));
  };

  const handleAddStrength = () => {
    if (newStrength.trim() && !strengths.includes(newStrength.trim())) {
      setStrengths([...strengths, newStrength.trim()]);
      setNewStrength("");
    }
  };

  const handleRemoveStrength = (item: string) => {
    setStrengths(strengths.filter((s) => s !== item));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch(apiPath(`/api/reps/${repId}/persona`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          experienceLevel,
          coachingTone,
          knownBlindspots: blindspots,
          strengths,
          managerNotes,
          targetQuota,
        }),
      });

      if (res.ok) {
        onSaved();
        onClose();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4">
      <div className="relative w-full max-w-2xl rounded-3xl glass-panel border border-black/[0.1] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-black/[0.08] px-6 py-4 bg-black/[0.02]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 text-[#007AFF]">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#1d1d1f]">Tune Rep Coaching Persona: {repName}</h2>
              <p className="text-xs text-[#6e6e73]">Configure coaching style, known blindspots, and private manager notes.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-[#6e6e73] hover:bg-black/[0.05] hover:text-[#1d1d1f] transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center text-[#6e6e73]">
            <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading Rep Persona...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-[#6e6e73] mb-1.5">
                  Experience & Role Level
                </label>
                <select
                  value={experienceLevel}
                  onChange={(e) => setExperienceLevel(e.target.value)}
                  className="w-full rounded-xl glass-inset border border-black/[0.08] px-3.5 py-2.5 text-xs text-[#1d1d1f] focus:border-blue-500/50 focus:outline-none"
                >
                  <option value="Rookie Outbound SDR">Rookie Outbound SDR (Focus: Fundamentals)</option>
                  <option value="Senior SDR">Senior SDR (Focus: High conversion)</option>
                  <option value="Ramping Account Executive">Ramping Account Executive (Focus: Qualification)</option>
                  <option value="Enterprise Closer">Enterprise Closer (Focus: Multi-threading & Price)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-[#6e6e73] mb-1.5">
                  AI Coaching Tone
                </label>
                <select
                  value={coachingTone}
                  onChange={(e) => setCoachingTone(e.target.value)}
                  className="w-full rounded-xl glass-inset border border-black/[0.08] px-3.5 py-2.5 text-xs text-[#1d1d1f] focus:border-blue-500/50 focus:outline-none"
                >
                  <option value="Tough Love / Direct VP">Tough Love / Direct VP (Direct, candid, high urgency)</option>
                  <option value="Analytical & Tactical">Analytical & Tactical (Metrics & phrase calibration)</option>
                  <option value="Structured & Step-by-Step">Structured & Step-by-Step (Patience, playbook rules)</option>
                </select>
              </div>
            </div>

            {/* Known Blindspots */}
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-[#6e6e73] mb-1">
                Known Blindspots & Bad Habits
              </label>
              <p className="text-xs text-[#6e6e73] mb-2">
                The AI Coach watches for these specific tendencies during call reviews.
              </p>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  placeholder="e.g. Folds immediately on 'send me an email'"
                  value={newBlindspot}
                  onChange={(e) => setNewBlindspot(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddBlindspot(); } }}
                  className="flex-1 rounded-xl glass-inset border border-black/[0.08] px-3.5 py-2 text-xs text-[#1d1d1f] placeholder:text-[#86868b] focus:border-blue-500/50 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddBlindspot}
                  className="rounded-xl bg-black/[0.04] border border-black/[0.08] px-3.5 py-2 text-xs font-medium text-[#1d1d1f] hover:bg-black/[0.08] transition"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {blindspots.map((b, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-3 py-1 text-xs text-[#D70015] border border-rose-500/20 font-medium"
                  >
                    {b}
                    <button
                      type="button"
                      onClick={() => handleRemoveBlindspot(b)}
                      className="text-[#FF3B30] hover:text-[#B60012] transition"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Strengths */}
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-[#6e6e73] mb-1">
                Core Strengths
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  placeholder="e.g. Confident tone, great technical clarity"
                  value={newStrength}
                  onChange={(e) => setNewStrength(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddStrength(); } }}
                  className="flex-1 rounded-xl glass-inset border border-black/[0.08] px-3.5 py-2 text-xs text-[#1d1d1f] placeholder:text-[#86868b] focus:border-blue-500/50 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddStrength}
                  className="rounded-xl bg-black/[0.04] border border-black/[0.08] px-3.5 py-2 text-xs font-medium text-[#1d1d1f] hover:bg-black/[0.08] transition"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {strengths.map((s, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-[#248A3D] border border-emerald-500/20 font-medium"
                  >
                    {s}
                    <button
                      type="button"
                      onClick={() => handleRemoveStrength(s)}
                      className="text-[#248A3D] hover:text-[#1C6D30] transition"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Manager 1-on-1 Notes */}
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-[#6e6e73] mb-1">
                Manager's Private 1-on-1 Notes & Directives
 </label>
 <p className="text-xs text-[#6e6e73] mb-1.5">
 Included in the AI Coach context for this rep's evaluations.
              </p>
              <textarea
                rows={4}
                placeholder="In our 1-on-1s, I've stressed that he must never let a prospect hang up without asking what they dislike about their current tool..."
                value={managerNotes}
                onChange={(e) => setManagerNotes(e.target.value)}
                className="w-full rounded-xl glass-inset border border-black/[0.08] p-3 font-mono text-xs text-[#1d1d1f] placeholder:text-[#86868b] focus:border-blue-500/50 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-black/[0.08] pt-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2 text-xs font-medium text-[#6e6e73] hover:bg-black/[0.05] hover:text-[#1d1d1f] transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-[#007AFF] px-5 py-2.5 text-xs font-medium text-white shadow-lg hover:bg-[#0071E3] transition disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Save Persona
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

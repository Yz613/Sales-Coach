"use client";

import { useState, useEffect } from "react";
import { BookOpen, Plus, Edit2, Trash2, CheckCircle2, ShieldCheck, Loader2 } from "lucide-react";
import ScriptEditorModal from "@/components/ScriptEditorModal";
import type { SalesScript } from "@/types";

export default function ScriptsPage() {
  const [scripts, setScripts] = useState<SalesScript[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedScript, setSelectedScript] = useState<SalesScript | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchScripts = () => {
    fetch("/api/admin/scripts")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setScripts(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchScripts();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this script?")) return;
    try {
      await fetch(`/api/admin/scripts/${id}`, { method: "DELETE" });
      fetchScripts();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEdit = (s: SalesScript) => {
    setSelectedScript(s);
    setIsModalOpen(true);
  };

  const handleNew = () => {
    setSelectedScript(null);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="rounded bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-blue-400 border border-blue-500/20">
              Manager Playbooks
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Prescribed Sales Scripts & Milestones
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Upload and configure scripts for each call stage. The AI Sales Manager directly grades call transcripts against these exact playbooks.
          </p>
        </div>

        <button
          onClick={handleNew}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow hover:bg-blue-500 transition"
        >
          <Plus className="h-4 w-4" /> Upload / New Script
        </button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading Playbooks...
        </div>
      ) : scripts.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-12 text-center space-y-3">
          <BookOpen className="h-10 w-10 text-slate-500 mx-auto" />
          <h3 className="text-base font-bold text-white">No Prescribed Scripts Configured Yet</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Upload your company's Cold Call, Discovery, or Closing scripts so the AI Coach can benchmark your reps' execution against your playbook.
          </p>
          <button
            onClick={handleNew}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition"
          >
            <Plus className="h-4 w-4" /> Create First Script
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {(["Cold Call", "First Discovery", "Follow-up"] as const).map((stage) => {
            const stageScripts = scripts.filter((s) => s.stage === stage);

            return (
              <div key={stage} className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-blue-400" />
                    {stage} Playbooks
                  </h2>
                  <span className="text-xs font-mono text-slate-500">
                    {stageScripts.length} registered
                  </span>
                </div>

                <div className="space-y-4">
                  {stageScripts.map((script) => (
                    <div
                      key={script.id}
                      className={`rounded-xl border p-5 space-y-4 transition ${
                        script.isActive
                          ? "border-blue-500/40 bg-slate-900/95 shadow-md shadow-blue-500/5"
                          : "border-slate-800 bg-slate-950/60 opacity-75"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-white">{script.title}</h3>
                            {script.isActive && (
                              <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                                ACTIVE
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEdit(script)}
                            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
                            title="Edit Script"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(script.id)}
                            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-rose-400 transition"
                            title="Delete Script"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Milestones checklist */}
                      {script.keyMilestones.length > 0 && (
                        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 space-y-2">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                            Required Milestones:
                          </span>
                          <ul className="space-y-1 text-xs text-slate-300">
                            {script.keyMilestones.map((m, idx) => (
                              <li key={idx} className="flex items-start gap-1.5 font-mono text-[11px]">
                                <CheckCircle2 className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />
                                <span>{m}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Content snippet */}
                      <div className="rounded-lg bg-slate-950/60 p-3 text-xs text-slate-400 font-mono leading-relaxed line-clamp-4 border border-slate-800/80">
                        {script.content}
                      </div>
                    </div>
                  ))}

                  {stageScripts.length === 0 && (
                    <div className="rounded-lg border border-dashed border-slate-800 p-6 text-center text-xs text-slate-500">
                      No active script for {stage}.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ScriptEditorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        scriptToEdit={selectedScript}
        onSaved={fetchScripts}
      />
    </div>
  );
}

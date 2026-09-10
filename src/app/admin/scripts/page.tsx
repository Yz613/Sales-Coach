"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Plus, Edit2, Trash2, CheckCircle2, Loader2, Pencil, X } from "lucide-react";
import { useAppAuth } from "@/lib/auth-context";
import ScriptEditorModal from "@/components/ScriptEditorModal";
import { apiPath } from "@/lib/utils";
import { DEFAULT_CALL_STAGES } from "@/lib/callStages";
import type { SalesScript } from "@/types";

export default function ScriptsPage() {
  const router = useRouter();
  const { isAdmin, isLoading: authLoading } = useAppAuth();
  const [scripts, setScripts] = useState<SalesScript[]>([]);
  const [stages, setStages] = useState<string[]>([...DEFAULT_CALL_STAGES]);
  const [loading, setLoading] = useState(true);
  const [selectedScript, setSelectedScript] = useState<SalesScript | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [initialStage, setInitialStage] = useState<string | undefined>(undefined);
  const [addingType, setAddingType] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [typeError, setTypeError] = useState<string | null>(null);
  const [renamingStage, setRenamingStage] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [savingType, setSavingType] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.replace("/calls");
    }
  }, [isAdmin, authLoading, router]);

  const fetchScripts = () => {
    Promise.all([
      fetch(apiPath("/api/admin/scripts")).then((res) => res.json()),
      fetch(apiPath("/api/admin/stages")).then((res) => res.json()),
    ])
      .then(([scriptData, stageData]) => {
        if (Array.isArray(scriptData)) setScripts(scriptData);
        if (Array.isArray(stageData?.stages) && stageData.stages.length) {
          setStages(stageData.stages);
        }
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
      await fetch(apiPath(`/api/admin/scripts/${id}`), { method: "DELETE" });
      fetchScripts();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEdit = (s: SalesScript) => {
    setSelectedScript(s);
    setInitialStage(s.stage);
    setIsModalOpen(true);
  };

  const handleNew = (stage?: string) => {
    setSelectedScript(null);
    setInitialStage(stage);
    setIsModalOpen(true);
  };

  const addScriptType = async () => {
    const name = newTypeName.trim();
    if (!name) {
      setTypeError("Enter a Call Stage Target name.");
      return;
    }
    setSavingType(true);
    setTypeError(null);
    try {
      const res = await fetch(apiPath("/api/admin/stages"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add script type");
      setStages(data.stages || []);
      setNewTypeName("");
      setAddingType(false);
      handleNew(name);
    } catch (err: any) {
      setTypeError(err.message || "Failed to add script type");
    } finally {
      setSavingType(false);
    }
  };

  const saveRename = async (from: string) => {
    const to = renameValue.trim();
    if (!to || to === from) {
      setRenamingStage(null);
      return;
    }
    setSavingType(true);
    setTypeError(null);
    try {
      const res = await fetch(apiPath("/api/admin/stages"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update Call Stage Target");
      setStages(data.stages || []);
      setRenamingStage(null);
      fetchScripts();
    } catch (err: any) {
      setTypeError(err.message || "Failed to update Call Stage Target");
    } finally {
      setSavingType(false);
    }
  };

  const removeStage = async (name: string) => {
    if (!confirm(`Remove the "${name}" script type? Scripts already on this stage must be moved or deleted first.`)) {
      return;
    }
    setTypeError(null);
    try {
      const res = await fetch(apiPath("/api/admin/stages"), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove script type");
      setStages(data.stages || []);
    } catch (err: any) {
      setTypeError(err.message || "Failed to remove script type");
    }
  };

  const displayStages = (() => {
    const extra = scripts.map((s) => s.stage).filter((s) => !stages.some((st) => st.toLowerCase() === s.toLowerCase()));
    return [...stages, ...extra];
  })();

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-blue-400 border border-blue-500/20">
              Manager Playbooks
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Prescribed Sales Scripts & Milestones
          </h1>
          <p className="text-xs text-slate-400 mt-1.5">
            Add any script type you run — not just the defaults. Each Call Stage Target is what the AI grades that playbook against.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setAddingType(true);
              setTypeError(null);
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-xs font-medium text-slate-200 hover:bg-white/[0.08] transition"
          >
            <Plus className="h-4 w-4" /> Add Script Type
          </button>
          <button
            onClick={() => handleNew()}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-xs font-medium text-white shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500 transition"
          >
            <Plus className="h-4 w-4" /> Upload / New Script
          </button>
        </div>
      </div>

      {addingType && (
        <div className="rounded-2xl glass-card p-5 flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-1.5">
              New Call Stage Target
            </label>
            <input
              type="text"
              autoFocus
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addScriptType();
                if (e.key === "Escape") setAddingType(false);
              }}
              placeholder="e.g. Demo, Renewal, Executive Briefing, Inbound Qualifier"
              className="w-full rounded-xl glass-inset border border-white/[0.08] px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-blue-500/50 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAddingType(false)}
              className="rounded-xl px-4 py-2 text-xs font-medium text-slate-400 hover:bg-white/[0.06] hover:text-white transition"
            >
              Cancel
            </button>
            <button
              onClick={addScriptType}
              disabled={savingType || !newTypeName.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-medium text-white shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500 transition disabled:opacity-50"
            >
              {savingType ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Create Type
            </button>
          </div>
        </div>
      )}

      {typeError && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-300">
          {typeError}
        </div>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading Playbooks...
        </div>
      ) : scripts.length === 0 && displayStages.length === 0 ? (
        <div className="rounded-2xl glass-card p-12 text-center space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 mx-auto mb-2">
            <BookOpen className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-white">No Prescribed Scripts Configured Yet</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Create a script type (Call Stage Target) and upload the playbook so the AI Coach can benchmark execution against it.
          </p>
          <button
            onClick={() => handleNew()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-xs font-medium text-white shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500 transition"
          >
            <Plus className="h-4 w-4" /> Create First Script
          </button>
        </div>
      ) : (
        <div className={`grid grid-cols-1 gap-6 ${displayStages.length > 3 ? "xl:grid-cols-4 lg:grid-cols-3" : "lg:grid-cols-3"}`}>
          {displayStages.map((stage) => {
            const stageScripts = scripts.filter((s) => s.stage.toLowerCase() === stage.toLowerCase());
            const isRenaming = renamingStage === stage;

            return (
              <div key={stage} className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/[0.08] pb-2.5 gap-2">
                  {isRenaming ? (
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveRename(stage);
                          if (e.key === "Escape") setRenamingStage(null);
                        }}
                        className="w-full rounded-xl glass-inset border border-white/[0.08] px-3 py-1.5 text-xs text-white focus:border-blue-500/50 focus:outline-none"
                      />
                      <button
                        onClick={() => saveRename(stage)}
                        disabled={savingType}
                        className="rounded-lg p-1.5 text-emerald-400 hover:bg-white/[0.06]"
                        title="Save Call Stage Target"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setRenamingStage(null)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.06]"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <h2 className="text-xs font-medium uppercase tracking-wider text-white flex items-center gap-2 min-w-0">
                        <span className="h-2 w-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)] shrink-0" />
                        <span className="truncate">{stage}</span>
                      </h2>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-xs font-mono text-slate-500 mr-1">
                          {stageScripts.length}
                        </span>
                        <button
                          onClick={() => {
                            setRenamingStage(stage);
                            setRenameValue(stage);
                            setTypeError(null);
                          }}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-white transition"
                          title="Update Call Stage Target"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {stageScripts.length === 0 && (
                          <button
                            onClick={() => removeStage(stage)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-rose-400 transition"
                            title="Remove empty script type"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleNew(stage)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-blue-400 transition"
                          title={`New ${stage} script`}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>

                <div className="space-y-4">
                  {stageScripts.map((script) => (
                    <div
                      key={script.id}
                      className={`rounded-2xl border p-5 space-y-4 transition ${
                        script.isActive
                          ? "border-blue-500/30 bg-slate-900/80 shadow-lg shadow-blue-500/5 backdrop-blur-xl"
                          : "glass-card opacity-75"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-white">{script.title}</h3>
                            {script.isActive && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                                ACTIVE
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEdit(script)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-white transition"
                            title="Edit Script"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(script.id)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-rose-400 transition"
                            title="Delete Script"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {script.keyMilestones.length > 0 && (
                        <div className="rounded-xl glass-inset border border-white/[0.08] p-3.5 space-y-2">
                          <span className="text-[10px] uppercase font-medium text-slate-400 block tracking-wider">
                            Required Milestones:
                          </span>
                          <ul className="space-y-1.5 text-xs text-slate-300">
                            {script.keyMilestones.map((m, idx) => (
                              <li key={idx} className="flex items-start gap-2 font-mono text-[11px]">
                                <CheckCircle2 className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />
                                <span>{m}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="rounded-xl glass-inset p-3.5 text-xs text-slate-400 font-mono leading-relaxed line-clamp-4 border border-white/[0.08]">
                        {script.content}
                      </div>
                    </div>
                  ))}

                  {stageScripts.length === 0 && (
                    <button
                      onClick={() => handleNew(stage)}
                      className="w-full rounded-2xl border-2 border-dashed border-white/[0.08] p-6 text-center text-xs text-slate-500 hover:border-blue-500/40 hover:text-slate-300 transition"
                    >
                      No script for {stage}. Click to add one.
                    </button>
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
        stages={stages}
        initialStage={initialStage}
      />
    </div>
  );
}

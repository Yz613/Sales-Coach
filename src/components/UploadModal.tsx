"use client";

import { useState, useEffect } from "react";
import { X, Upload, FileText, Layers, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { apiPath } from "@/lib/utils";
import { useAppAuth } from "@/lib/auth-context";
import type { Rep } from "@/types";
import { DEFAULT_CALL_STAGES } from "@/lib/callStages";
import CallStageSelect from "@/components/CallStageSelect";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (callId: string) => void;
}

export default function UploadModal({ isOpen, onClose, onSuccess }: UploadModalProps) {
  const router = useRouter();
  const { isAdmin, user } = useAppAuth();
  const lockToSelf = !isAdmin;
  const [reps, setReps] = useState<Rep[]>([]);
  const [selectedRepId, setSelectedRepId] = useState("new");
  const [newRepName, setNewRepName] = useState("");
  const [newRepRole, setNewRepRole] = useState("");
  const [newRepFocus, setNewRepFocus] = useState("");
  const [prospectCompany, setProspectCompany] = useState("");
  const [prospectName, setProspectName] = useState("");
  const [callStage, setCallStage] = useState("Cold Call");
  const [stages, setStages] = useState<string[]>([...DEFAULT_CALL_STAGES]);
  const [transcriptText, setTranscriptText] = useState("");
  const [singleFile, setSingleFile] = useState<File | null>(null);

  // Multi-upload state
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [activeTab, setActiveTab] = useState<"paste" | "single_file" | "batch">("paste");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [batchSuccessCount, setBatchSuccessCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setBatchSuccessCount(null);
      setBatchProgress(null);
      fetch(apiPath("/api/reps"))
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data) && data.length > 0) {
            setReps(data);
            setSelectedRepId(data[0].id);
          } else {
            setReps([]);
            setSelectedRepId("new");
            if (lockToSelf) {
              setNewRepName(user?.name || "");
            }
          }
        })
        .catch(console.error);
      fetch(apiPath("/api/stages"))
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data?.stages) && data.stages.length) {
            setStages(data.stages);
            setCallStage((current) =>
              data.stages.some((s: string) => s === current) ? current : data.stages[0]
            );
          }
        })
        .catch(console.error);
    }
  }, [isOpen, lockToSelf, user?.name]);

  if (!isOpen) return null;

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (activeTab === "paste" && !transcriptText.trim()) {
      setError("Please paste a transcript to evaluate.");
      return;
    }

    if (activeTab === "single_file" && !singleFile) {
      setError("Please select a transcript or audio file to upload.");
      return;
    }

    if (!prospectCompany.trim()) {
      setError("Please specify the prospect's company.");
      return;
    }

    if (!lockToSelf && selectedRepId === "new" && !newRepName.trim()) {
      setError("Please enter the sales rep's name.");
      return;
    }

    if (!callStage.trim()) {
      setError("Please choose a Call Stage Target or type a new one.");
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("repId", selectedRepId);
      formData.append(
        "repName",
        selectedRepId === "new"
          ? newRepName.trim()
          : reps.find((r) => r.id === selectedRepId)?.name || "Rep"
      );
      formData.append("repRole", selectedRepId === "new" ? newRepRole.trim() : "");
      formData.append("repFocus", selectedRepId === "new" ? newRepFocus.trim() : "");
      formData.append("prospectCompany", prospectCompany.trim());
      formData.append("prospectName", prospectName.trim() || "Lead Contact");
      formData.append("callStage", callStage);

      if (activeTab === "paste") {
        formData.append("transcriptText", transcriptText.trim());
      } else if (singleFile) {
        formData.append("file", singleFile);
      }

      const res = await fetch(apiPath("/api/calls/upload"), {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to process call upload");
      }

      setIsSubmitting(false);
      onClose();
      if (onSuccess) {
        onSuccess(data.callId);
      } else {
        router.push(`/calls/${data.callId}`);
        router.refresh();
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setError(err.message || "An error occurred during call upload.");
    }
  };

  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchFiles.length) {
      setError("Please select at least 1 file to batch upload.");
      return;
    }

    if (!lockToSelf && selectedRepId === "new" && !newRepName.trim()) {
      setError("Please enter the sales rep's name.");
      return;
    }

    if (!callStage.trim()) {
      setError("Please choose a Call Stage Target or type a new one.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    setBatchProgress({ current: 0, total: batchFiles.length });

    try {
      const formData = new FormData();
      formData.append("defaultRepId", selectedRepId);
      formData.append("defaultRepName", selectedRepId === "new" ? newRepName.trim() : "");
      formData.append("defaultRepRole", selectedRepId === "new" ? newRepRole.trim() : "");
      formData.append("defaultRepFocus", selectedRepId === "new" ? newRepFocus.trim() : "");
      formData.append("defaultStage", callStage);
      batchFiles.forEach((f) => {
        formData.append("files", f);
      });

      const res = await fetch(apiPath("/api/calls/batch-upload"), {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to process batch upload");
      }

      setIsSubmitting(false);
      setBatchSuccessCount(data.processedCount || batchFiles.length);
      router.refresh();
    } catch (err: any) {
      setIsSubmitting(false);
      setError(err.message || "Batch upload failed");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl rounded-xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-white">Upload Calls for AI Coaching</h2>
            <p className="text-xs text-slate-400">
              Evaluates blocking & tackling, early folding, and stage-specific Sandler qualification.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 px-6 pt-2 text-xs font-semibold uppercase tracking-wider">
          <button
            type="button"
            onClick={() => { setActiveTab("paste"); setError(null); }}
            className={`flex items-center gap-2 pb-3 pt-1 border-b-2 transition ${
              activeTab === "paste"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <FileText className="h-4 w-4" /> Paste Transcript
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab("single_file"); setError(null); }}
            className={`flex items-center gap-2 pb-3 pt-1 border-b-2 ml-6 transition ${
              activeTab === "single_file"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Upload className="h-4 w-4" /> Single Audio/Transcript File
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab("batch"); setError(null); }}
            className={`flex items-center gap-2 pb-3 pt-1 border-b-2 ml-6 transition ${
              activeTab === "batch"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="h-4 w-4" /> Multi-Call Batch Upload
          </button>
        </div>

        {batchSuccessCount !== null ? (
          <div className="p-8 text-center space-y-4">
            <div className="h-12 w-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Batch Upload Completed!</h3>
            <p className="text-sm text-slate-300 max-w-md mx-auto">
              Successfully ingested and coached <strong>{batchSuccessCount} sales calls</strong> across your prescribed scripts and Sandler dimensions.
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <button
                onClick={() => {
                  onClose();
                  router.push("/calls");
                }}
                className="rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition"
              >
                Go to Call Bank
              </button>
              {!lockToSelf && (
                <button
                  onClick={() => {
                    onClose();
                    router.push("/");
                  }}
                  className="rounded-lg bg-slate-800 border border-slate-700 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-700 transition"
                >
                  View Super Admin Report
                </button>
              )}
            </div>
          </div>
        ) : activeTab === "batch" ? (
          /* Multi-Call / Batch Upload Form */
          <form onSubmit={handleBatchSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                  Assign Rep (Default for batch)
                </label>
                {lockToSelf ? (
                  <div className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">
                    {user?.name || user?.email || "You"}
                    <p className="mt-1 text-xs text-slate-500">Calls are saved to your account only.</p>
                  </div>
                ) : (
                <select
                  value={selectedRepId}
                  onChange={(e) => setSelectedRepId(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                >
                  {reps.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.role})
                    </option>
                  ))}
                  <option value="new">＋ Add new rep…</option>
                </select>
                )}
                {!lockToSelf && selectedRepId === "new" && (
                  <div className="mt-2 grid grid-cols-1 gap-2">
                    <input
                      type="text"
                      placeholder="Rep name (e.g. Jordan Lee)"
                      value={newRepName}
                      onChange={(e) => setNewRepName(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Role (optional, e.g. Account Executive)"
                      value={newRepRole}
                      onChange={(e) => setNewRepRole(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                    />
                    <textarea
                      rows={2}
                      placeholder="What should the coach help this rep work on? (optional) — factored into every evaluation of their calls"
                      value={newRepFocus}
                      onChange={(e) => setNewRepFocus(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <CallStageSelect
                label="Call Stage Target (Default for batch)"
                value={callStage}
                stages={stages.includes(callStage) || !callStage ? stages : [...stages, callStage]}
                onChange={setCallStage}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                Select Multiple Call Transcripts or Audio Files
              </label>
              <div className="relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-700 bg-slate-950/60 p-8 text-center hover:border-blue-500 transition">
                <Layers className="h-8 w-8 text-blue-400 mb-2" />
                <p className="text-sm font-semibold text-white">
                  Drop multiple files or click to browse
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Supports multiple .txt, .vtt, .srt, .json, .mp3, .wav, .m4a files
                </p>
                <input
                  type="file"
                  multiple
                  accept=".txt,.vtt,.srt,.json,.mp3,.wav,.m4a"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setBatchFiles(files);
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>
            </div>

            {batchFiles.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Selected Files: <strong>{batchFiles.length}</strong></span>
                  <button
                    type="button"
                    onClick={() => setBatchFiles([])}
                    className="text-rose-400 hover:underline"
                  >
                    Clear All
                  </button>
                </div>
                <div className="max-h-32 overflow-y-auto space-y-1 rounded-lg border border-slate-800 bg-slate-950 p-2 font-mono text-xs">
                  {batchFiles.map((f, idx) => (
                    <div key={idx} className="flex items-center justify-between py-1 px-2 text-slate-300 hover:bg-slate-900 rounded">
                      <span className="truncate max-w-xs">{f.name}</span>
                      <span className="text-slate-500 text-[10px]">{Math.round(f.size / 1024)} KB</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !batchFiles.length}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing {batchFiles.length} Calls in Batch...
                  </>
                ) : (
                  <>
                    <Layers className="h-4 w-4" />
                    Coach {batchFiles.length} Calls in Batch
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* Single Call Upload Form */
          <form onSubmit={handleSingleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                  Sales Rep
                </label>
                {lockToSelf ? (
                  <div className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">
                    {user?.name || user?.email || "You"}
                    <p className="mt-1 text-xs text-slate-500">Only you can see these calls.</p>
                  </div>
                ) : (
                <select
                  value={selectedRepId}
                  onChange={(e) => setSelectedRepId(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                >
                  {reps.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.role})
                    </option>
                  ))}
                  <option value="new">＋ Add new rep…</option>
                </select>
                )}
                {!lockToSelf && selectedRepId === "new" && (
                  <div className="mt-2 grid grid-cols-1 gap-2">
                    <input
                      type="text"
                      placeholder="Rep name (e.g. Jordan Lee)"
                      value={newRepName}
                      onChange={(e) => setNewRepName(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Role (optional, e.g. Account Executive)"
                      value={newRepRole}
                      onChange={(e) => setNewRepRole(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                    />
                    <textarea
                      rows={2}
                      placeholder="What should the coach help this rep work on? (optional) — factored into every evaluation of their calls"
                      value={newRepFocus}
                      onChange={(e) => setNewRepFocus(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <CallStageSelect
                label="Call Stage Target"
                value={callStage}
                stages={stages.includes(callStage) || !callStage ? stages : [...stages, callStage]}
                onChange={setCallStage}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                  Prospect Company
                </label>
                <input
                  type="text"
                  placeholder="e.g. Acme Corp"
                  value={prospectCompany}
                  onChange={(e) => setProspectCompany(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                  Prospect Contact & Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Jane Doe (VP Operations)"
                  value={prospectName}
                  onChange={(e) => setProspectName(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {activeTab === "paste" ? (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                  Paste Call Dialogue / Transcript
                </label>
                <textarea
                  rows={8}
                  placeholder={`Rep: Hi, this is [rep] from [your company]...\nProspect: We're already working with another vendor.\nRep: Totally understand. Quick question before I let you go — what's the one thing you'd change about how that's working today?`}
                  value={transcriptText}
                  onChange={(e) => setTranscriptText(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 font-mono text-xs text-slate-200 placeholder-slate-600 focus:border-blue-500 focus:outline-none"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                  Call File (.txt, .vtt, .srt, .mp3, .wav)
                </label>
                <div className="relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-700 bg-slate-950/60 p-8 text-center hover:border-blue-500 transition">
                  <Upload className="h-8 w-8 text-blue-400 mb-2" />
                  <p className="text-sm font-semibold text-white">
                    {singleFile ? singleFile.name : "Select transcript or audio recording"}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Supports .txt, .vtt, .srt, .json, .mp3, .wav, .m4a
                  </p>
                  <input
                    type="file"
                    accept=".txt,.vtt,.srt,.json,.mp3,.wav,.m4a"
                    onChange={(e) => setSingleFile(e.target.files?.[0] || null)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Coaching Call...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Ingest & Coach Call
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

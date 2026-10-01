"use client";
import { useEffect, useRef, useState } from "react";
import { buttonClass, Notice, request } from "./ui";
import CallRecording from "../CallRecording";
export default function FathomRecording({ callId, transcript, duration }: { callId: string; transcript: string; duration: number }) {
  const [recording,setRecording] = useState<any>(null); const [busy,setBusy] = useState(false); const [error,setError] = useState(""); const attempts = useRef(0);
  const load = async (downloadId?: string) => { setBusy(true); setError(""); try { const data = await request(`/api/conversations/${callId}`, { action: "recording", ...(downloadId ? { downloadId } : {}) }); if (["failed", "expired"].includes(data.status)) throw new Error("The recording could not be prepared. Try loading it again."); setRecording(data); } catch(e) { setError((e as Error).message); setRecording(null); } finally { setBusy(false); } };
  useEffect(() => { if (recording?.status !== "processing") return;
    if (attempts.current++ >= 24) { setError("The recording is still preparing. Try loading it again in a few minutes."); setRecording(null); return; }
    const timer = setTimeout(() => load(recording.downloadId), 5000); return () => clearTimeout(timer);
  }, [recording]);
  return <div className="space-y-3"><Notice error={error} /><div className="rounded-lg border border-black/10 bg-white p-4 flex justify-between gap-3 items-center"><p className="text-xs text-[#6e6e73]">{recording?.status === "processing" ? "Fathom is preparing the recording…" : "Load the recording from Fathom to watch and jump between transcript timestamps."}</p><button className={buttonClass} disabled={busy || recording?.status === "processing"} onClick={() => { attempts.current = 0; load(); }}>{recording?.url ? "Refresh recording" : busy ? "Loading…" : "Load recording"}</button></div><CallRecording audioUrl={recording?.url || undefined} mediaKind={recording?.kind === "video" ? "video" : "audio"} transcriptText={transcript} durationSeconds={duration} /></div>;
}

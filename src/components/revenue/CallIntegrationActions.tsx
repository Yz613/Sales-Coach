"use client";
import { useEffect, useState } from "react";
import { Card, fieldClass, secondaryClass, request } from "./ui";
import { integrationTool } from "@/lib/integrations/catalog";

export default function CallIntegrationActions({ callId, linked, clips }: { callId: string; linked: any[]; clips: any[] }) {
  const [connections, setConnections] = useState<any[]>([]); const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true);
  useEffect(() => { request("/api/integrations").then(data => setConnections(data.connections)).catch(e => setError(e.message)).finally(() => setLoading(false)); }, []);
  const destinations = connections.flatMap(c => {
    const tool = integrationTool(c.provider);
    if (tool?.category === "CRM") return linked.filter(r => r.connectionId === c.id).map(r => ({ key: `${c.id}:${r.id}`, connectionId: c.id, targetId: r.id, label: `${c.name} · ${r.kind}: ${r.name}`, channel: false }));
    return tool?.category === "Notifications" || tool?.category === "Automation" && c.config.outboundConfigured ? [{ key: c.id, connectionId: c.id, targetId: undefined, label: c.name, channel: tool?.category === "Notifications" }] : [];
  });
  const [selected, setSelected] = useState(""); const destination = destinations.find(d => d.key === selected);
  return <Card title="Send to your tools"><p className="text-xs text-[#6e6e73]">Share a call or clip with your team, export its summary and next steps to a linked CRM record, or trigger an automation. Call links follow workspace access permissions.</p>{error && <p role="alert" className="text-xs text-red-700">{error}</p>}{message && <p role="status" className="text-xs text-emerald-700">{message}</p>}{loading ? <p className="text-xs text-[#86868b]">Loading connected tools…</p> : destinations.length ? <form className="space-y-3" onSubmit={async e => {
    e.preventDefault(); const clipId = new FormData(e.currentTarget).get("clipId"); if (!destination) return;
    setBusy(true); setError(""); setMessage(""); try { await request(`/api/integrations/${destination.connectionId}/exports`, { action: "send", callId, targetId: destination.targetId, ...(destination.channel && clipId ? { clipId } : {}) }); setMessage("Queued. Check Recent activity on the integration page for delivery."); } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }}><label className="block text-xs space-y-1">Destination<select required className={fieldClass} value={selected} onChange={e => setSelected(e.target.value)}><option value="">Choose a connected tool</option>{destinations.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}</select></label>{destination?.channel && clips.length > 0 && <label className="block text-xs space-y-1">What to share<select name="clipId" className={fieldClass}><option value="">Full call</option>{clips.map(clip => <option key={clip.id} value={clip.id}>{clip.title} · {clip.startSeconds}–{clip.endSeconds}s</option>)}</select></label>}<button disabled={busy || !destination} className={secondaryClass}>{busy ? "Sending…" : "Send call"}</button></form> : <p className="text-xs text-[#86868b]">Connect Slack/Discord, link a CRM record, or configure an outbound Zapier/Make webhook to send this call.</p>}</Card>;
}

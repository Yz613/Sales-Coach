"use client";
import { useState } from "react";
import Link from "next/link";
import { formatDuration } from "@/lib/utils";
import { Card, fieldClass, buttonClass, secondaryClass, request } from "./ui";

type Concept = { id: string; name: string; concept: string; speaker: string; hits: number };
type KeywordTracker = { id: string; name: string };
type Stream = { id: string; name: string; filter: { type: string; trackerId?: string; keyword?: string; maxScore?: number; stage?: string }; slack: boolean; discord: boolean; inApp: boolean };
type Alert = { id: string; callId: string; title: string; body: string; startSeconds: number | null; readAt: string | null; createdAt: string };

function streamLabel(stream: Stream, concepts: Concept[], trackers: KeywordTracker[]) {
  const filter = stream.filter;
  const target = filter.type === "concept" ? concepts.find(item => item.id === filter.trackerId)?.name
    : filter.type === "tracker" ? trackers.find(item => item.id === filter.trackerId)?.name
    : filter.type === "keyword" ? `“${filter.keyword}”`
    : filter.type === "low-score" ? `score below ${filter.maxScore}`
    : filter.stage;
  const channels = [stream.slack && "Slack", stream.discord && "Discord", stream.inApp && "In-app"].filter(Boolean).join(", ");
  return `${target || filter.type} · ${channels}`;
}

export default function TrackerAlerts({ admin, open, concepts, trackers, streams, alerts, busy, run }: {
  admin: boolean; open: boolean; concepts: Concept[]; trackers: KeywordTracker[]; streams: Stream[]; alerts: Alert[];
  busy: boolean; run: (fn: () => Promise<any>) => Promise<void>;
}) {
  const [filterType, setFilterType] = useState("concept");
  return <>
    {alerts.length > 0 && <Card title="Stream alerts"><p className="text-xs text-[#6e6e73]">In-app alerts from your workspace streams. Channel messages still go out through Slack or Discord.</p>
      {alerts.map(alert => <div key={alert.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg bg-[#F5F5F7] p-3">
        <div><p className="text-sm font-medium">{alert.title}</p><p className="text-sm text-[#6e6e73] mt-1">{alert.body}</p><p className="text-xs text-[#86868b] mt-1">{new Date(alert.createdAt).toLocaleString()}{alert.readAt ? " · Read" : ""}</p></div>
        <div className="flex gap-2">
          <Link className="text-xs text-[#007AFF]" href={`/calls/${alert.callId}${alert.startSeconds != null ? `#t-${alert.startSeconds}` : ""}`}>{alert.startSeconds != null ? formatDuration(alert.startSeconds) : "Open call"}</Link>
          {!alert.readAt && <button disabled={busy} className="text-xs text-[#86868b]" onClick={() => run(() => request("/api/streams", { action: "read", id: alert.id }))}>Mark read</button>}
        </div>
      </div>)}
    </Card>}
    {admin && open && <Card title="Concept trackers"><p className="text-xs text-[#6e6e73]">Describe a concept, such as a pricing objection or a competitor mention. The model in Settings marks matching moments, including paraphrases, and stores a timestamp you can jump to. Each scanned call uses one evaluation credit.</p>
      {concepts.map(tracker => <div key={tracker.id} className="flex flex-wrap items-start justify-between gap-3 text-sm"><div><span className="font-medium">{tracker.name}</span> <span className="text-[#86868b]">· {tracker.speaker} · {tracker.hits} moment{tracker.hits === 1 ? "" : "s"}</span><p className="text-[#6e6e73]">{tracker.concept}</p></div><span className="flex gap-3"><button disabled={busy} className="text-[#007AFF]" onClick={() => run(() => request("/api/ai-trackers", { action: "scan", id: tracker.id }))}>Scan</button><button disabled={busy} className="text-red-600" onClick={() => run(() => request("/api/ai-trackers", { id: tracker.id }, "DELETE"))}>Delete</button></span></div>)}
      <form className="grid gap-3" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); run(() => request("/api/ai-trackers", { name: f.get("name"), concept: f.get("concept"), speaker: f.get("speaker") })); e.currentTarget.reset(); }}>
        <label className="text-xs space-y-1">Tracker name<input name="name" required className={fieldClass} placeholder="Pricing objection" /></label>
        <label className="text-xs space-y-1">Concept<textarea name="concept" required className={fieldClass} rows={3} maxLength={1000} placeholder="The buyer pushes back on price or cost, even if they never say pricing." /></label>
        <label className="text-xs space-y-1">Speaker<select name="speaker" className={fieldClass} defaultValue="any"><option value="any">Anyone</option><option value="buyer">Buyer</option><option value="rep">Rep</option></select></label>
        <button disabled={busy} className={buttonClass}>Add concept tracker</button>
      </form>
    </Card>}
    {admin && open && <Card title="Alert streams"><p className="text-xs text-[#6e6e73]">Subscribe to a tracker hit, a keyword, a low script score, or a deal stage. Slack and Discord use the channels you already connected. In-app alerts do not need an email mailbox. The background worker delivers them.</p>
      {streams.map(stream => <div key={stream.id} className="flex justify-between gap-3 text-sm"><span>{stream.name} · <span className="text-[#86868b]">{streamLabel(stream, concepts, trackers)}</span></span><button disabled={busy} className="text-red-600" onClick={() => run(() => request("/api/streams", { id: stream.id }, "DELETE"))}>Delete</button></div>)}
      <form className="grid gap-3" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); run(() => request("/api/streams", { name: f.get("name"), type: f.get("type"), trackerId: f.get("trackerId"), keyword: f.get("keyword"), maxScore: f.get("maxScore") ? Number(f.get("maxScore")) : undefined, stage: f.get("stage"), slack: f.get("slack") === "on", discord: f.get("discord") === "on", inApp: f.get("inApp") === "on" })); e.currentTarget.reset(); }}>
        <label className="text-xs space-y-1">Stream name<input name="name" required className={fieldClass} placeholder="Pricing objections" /></label>
        <label className="text-xs space-y-1">When<select name="type" className={fieldClass} value={filterType} onChange={e => setFilterType(e.target.value)}><option value="concept">Concept tracker hits</option><option value="tracker">Keyword tracker hits</option><option value="keyword">Transcript contains a keyword</option><option value="low-score">Script score is below</option><option value="deal-stage">Linked deal stage</option></select></label>
        {filterType === "concept" && <label className="text-xs space-y-1">Concept tracker<select name="trackerId" required className={fieldClass}>{concepts.length ? concepts.map(tracker => <option key={tracker.id} value={tracker.id}>{tracker.name}</option>) : <option value="">Add a concept tracker first</option>}</select></label>}
        {filterType === "tracker" && <label className="text-xs space-y-1">Keyword tracker<select name="trackerId" required className={fieldClass}>{trackers.length ? trackers.map(tracker => <option key={tracker.id} value={tracker.id}>{tracker.name}</option>) : <option value="">Add a keyword tracker first</option>}</select></label>}
        {filterType === "keyword" && <label className="text-xs space-y-1">Keyword or phrase<input name="keyword" required className={fieldClass} placeholder="Northwind" /></label>}
        {filterType === "low-score" && <label className="text-xs space-y-1">Alert when the script score is below<input name="maxScore" type="number" min={1} max={10} required defaultValue={5} className={fieldClass} /></label>}
        {filterType === "deal-stage" && <label className="text-xs space-y-1">Deal stage<input name="stage" required className={fieldClass} placeholder="Negotiation" /></label>}
        <div className="flex flex-wrap gap-4 text-sm"><label className="flex items-center gap-2"><input name="slack" type="checkbox" />Slack</label><label className="flex items-center gap-2"><input name="discord" type="checkbox" />Discord</label><label className="flex items-center gap-2"><input name="inApp" type="checkbox" defaultChecked />In-app</label></div>
        <button disabled={busy} className={secondaryClass}>Add stream</button>
      </form>
    </Card>}
  </>;
}

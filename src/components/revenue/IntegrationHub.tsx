"use client";
import { useEffect, useState } from "react";
import { Card, Notice, fieldClass, buttonClass, secondaryClass, request } from "./ui";

export default function IntegrationHub({ initial }: { initial: { connections: any[]; jobs: any[] } }) {
  const [data, setData] = useState(initial); const [provider, setProvider] = useState("hubspot"); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const refresh = async () => setData(await request("/api/integrations"));
  useEffect(() => { const active = data.jobs.some(j => j.status === "queued" || j.status === "running"); if (!active) return; const timer = setInterval(() => { refresh().catch(e => setError(e.message)); }, 5000); return () => clearInterval(timer); }, [data.jobs]);
  const run = async (fn: () => Promise<any>, success: string) => { setBusy(true); setError(""); setMessage(""); try { await fn(); await refresh(); setMessage(success); } catch(e) { setError((e as Error).message); } finally { setBusy(false); } };
  return <div className="space-y-6">
    <Notice error={error} message={message} />
    <Card title="Connect a sales tool">
      <div className="flex flex-wrap gap-2">{["hubspot", "fathom"].map(p => <button key={p} className={p === provider ? buttonClass : secondaryClass} onClick={() => setProvider(p)}>{p === "hubspot" ? "HubSpot" : "Fathom"}</button>)}</div>
      <p className="text-sm text-[#6e6e73]">{provider === "hubspot" ? "Sync companies, contacts, deals, and their associations. Create a Service Key with read access to those three objects. Existing private app tokens also work." : "Import your accessible meetings, transcripts, speaker timestamps, summaries, and action items. Create a personal API key in Fathom. Access follows the recordings shared with that user."}</p>
      <form key={provider} className="grid gap-4 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); const form = e.currentTarget; const f = new FormData(form); run(async () => { await request("/api/integrations", { provider, name: f.get("name"), token: f.get("token"), defaultStage: f.get("stage"), autoSync: f.get("autoSync") === "on", autoEvaluate: f.get("autoEvaluate") === "on" }); form.reset(); }, "Connected. The first sync is queued."); }}>
        <label className="text-sm space-y-1">Connection name<input name="name" required defaultValue={provider === "hubspot" ? "HubSpot CRM" : "Fathom meetings"} className={fieldClass} maxLength={200} /></label>
        <label className="text-sm space-y-1">{provider === "hubspot" ? "Service Key or private app token" : "Fathom API key"}<input name="token" required type="password" autoComplete="off" className={fieldClass} maxLength={4096} /></label>
        {provider === "fathom" && <label className="text-sm space-y-1">Default call stage<input name="stage" defaultValue="First Discovery" className={fieldClass} required /></label>}
        <input type="hidden" name="stage" value={provider === "hubspot" ? "First Discovery" : ""} disabled={provider === "fathom"} />
        <div className="space-y-2 text-sm sm:col-span-2"><label className="flex gap-2 items-center"><input name="autoSync" type="checkbox" defaultChecked /> Sync automatically every 15 minutes</label>{provider === "fathom" && <label className="flex gap-2 items-center"><input name="autoEvaluate" type="checkbox" /> Automatically evaluate imported calls (uses your AI provider and evaluation allowance)</label>}</div>
        <div className="sm:col-span-2"><button disabled={busy} className={buttonClass}>{busy ? "Connecting…" : "Connect and import"}</button></div>
      </form>
      <a className="inline-block text-xs text-[#007AFF]" target="_blank" rel="noreferrer" href={provider === "hubspot" ? "https://developers.hubspot.com/developer-platform-basics" : "https://developers.fathom.ai/quickstart"}>Open {provider === "hubspot" ? "HubSpot" : "Fathom"} API documentation ↗</a>
    </Card>
    <Card title="Connected tools">
      {!data.connections.length && <p className="text-sm text-[#86868b]">No tools connected yet.</p>}
      {data.connections.map(c => <div key={c.id} className="space-y-3 border-b border-black/10 pb-4 last:border-0 last:pb-0">
        <div className="flex justify-between gap-3"><div><h3 className="font-medium">{c.name}</h3><p className="text-xs text-[#6e6e73]">{c.provider} · {c.status} · {c.lastSyncedAt ? `Last sync ${new Date(c.lastSyncedAt).toLocaleString()}` : "First sync pending"}</p></div><span className={`h-fit rounded-full px-2 py-1 text-xs ${c.status === "error" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"}`}>{c.status}</span></div>
        {c.lastError && <p className="text-sm text-red-700">{c.lastError}</p>}
        <div className="flex flex-wrap gap-2"><button disabled={busy} className={secondaryClass} onClick={() => run(() => request(`/api/integrations/${c.id}`, { action: "sync" }), "Sync queued.")}>Sync now</button><button disabled={busy} className={secondaryClass} onClick={() => run(() => request(`/api/integrations/${c.id}`, { action: "sync", full: true }), "Full import queued; existing calls are deduplicated.")}>Full sync</button>{c.provider === "fathom" && <button disabled={busy || Boolean(c.config.webhookId)} className={secondaryClass} onClick={() => run(() => request(`/api/integrations/${c.id}`, { action: "webhook" }), "Signed Fathom webhook enabled.")}>{c.config.webhookId ? "Webhook enabled" : "Enable live webhook"}</button>}<button disabled={busy} className="text-sm text-red-600 px-2" onClick={() => { if (confirm(`Disconnect ${c.name}? Imported calls and CRM records will remain.`)) run(() => request(`/api/integrations/${c.id}`, {}, "DELETE"), "Disconnected."); }}>Disconnect</button></div>
        <div className="flex flex-wrap gap-4 text-xs"><label className="flex gap-2"><input type="checkbox" disabled={busy} checked={c.config.autoSync} onChange={e => run(() => request(`/api/integrations/${c.id}`, { action: "configure", ...c.config, autoSync: e.target.checked }), "Sync preference saved.")} />Automatic sync</label>{c.provider === "fathom" && <label className="flex gap-2"><input type="checkbox" disabled={busy} checked={c.config.autoEvaluate} onChange={e => run(() => request(`/api/integrations/${c.id}`, { action: "configure", ...c.config, autoEvaluate: e.target.checked }), "Evaluation preference saved.")} />Automatic evaluation</label>}</div>
      </div>)}
    </Card>
    <Card title="Processing activity"><div className="flex gap-2"><button className={secondaryClass} disabled={busy} onClick={() => run(() => request("/api/jobs", {}), "Worker started.")}>Process pending jobs</button><button className={secondaryClass} disabled={busy} onClick={() => run(refresh, "Activity refreshed.")}>Refresh</button></div>
      <p className="text-xs text-[#6e6e73]">Run the background worker for continuous imports and scheduled syncs. Cloudflare deployments can use the built-in cron trigger.</p>
      <div className="space-y-2">{data.jobs.length ? data.jobs.map(j => <div key={j.id} className="flex justify-between items-center gap-3 rounded-lg bg-[#F5F5F7] p-3 text-xs"><div><strong>{j.kind}</strong> · {j.status} · {j.attempts} attempts {j.result && <span>· {j.result}</span>}{j.lastError && <p className="text-red-600 mt-1">{j.lastError}</p>}</div>{j.status === "failed" && <button disabled={busy} className={secondaryClass} onClick={() => run(() => request("/api/jobs", { id: j.id }), "Retry queued.")}>Retry</button>}</div>) : <p className="text-sm text-[#86868b]">No processing jobs yet.</p>}</div>
    </Card>
  </div>;
}

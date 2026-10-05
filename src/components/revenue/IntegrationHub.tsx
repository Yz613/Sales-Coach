"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Copy, ExternalLink, Radio, Search, ShieldCheck } from "lucide-react";
import { INTEGRATION_TOOLS, integrationTool, isCallTool, isNotificationTool } from "@/lib/integrations/catalog";
import type { ProviderId, ConnectionConfig } from "@/lib/revenue/types";
import { integrationCapabilities } from "@/lib/integrations/capabilities";
import { oauthButtonLabel, type OAuthProvider } from "@/lib/integrations/oauth-config";
import IntegrationDestinationSetup from "./IntegrationDestinationSetup";
import IntegrationDeliveries from "./IntegrationDeliveries";
import HubspotPropertyMapping from "./HubspotPropertyMapping";
import IntegrationLogo from "./IntegrationLogo";
import IntegrationMeetings from "./IntegrationMeetings";
import IntegrationTasks from "./IntegrationTasks";
import { Card, Notice, fieldClass, buttonClass, secondaryClass, request } from "./ui";

type Connection = { id: string; provider: ProviderId; name: string; status: string; config: ConnectionConfig; lastSyncedAt: string | null; lastError: string | null };
type Job = { id: string; kind: string; connectionId: string | null; status: string; attempts: number; result: string | null; lastError: string | null; createdAt: string };
export type IntegrationData = { connections: Connection[]; jobs: Job[]; oauth?: Record<string, boolean> };
type Feed = { url: string; token?: string };
const SAMPLE_CALL = JSON.stringify({ externalId: "your-source-call-id", title: "Discovery with Acme", repName: "Alex", repEmail: "alex@example.com", prospectName: "Pat", prospectCompany: "Acme", createdAt: "2026-10-01T14:00:00Z", durationSeconds: 60, transcriptText: "Alex: What is your biggest challenge?\nPat: We need better reporting." }, null, 2);
const JOB_NAMES: Record<string, string> = { sync: "Sync history", import: "Import call", transcript: "Fetch transcript", "fetch-call": "Fetch call", "crm-event": "Live CRM update", evaluate: "Coach call", "calendar-event": "Import meeting invitees", "notify-slack": "Send coaching alert", "export-task": "Send coaching task", "export-call": "Export call", "scan-alerts": "Scan concept trackers", "write-crm-properties": "Update HubSpot properties" };
function liveStatus(c: Connection) {
  if (c.config.pendingSetup) return "Choose destination";
  if (isNotificationTool(c.provider)) return c.config.notifyReviewed || c.config.notifyClips || c.config.notifyLowScore ? "Alerts enabled" : "Alerts off";
  if (c.config.lastWebhookAt) return "Receiving live events";
  if (c.config.webhookId) return "Live feed ready";
  if (c.config.webhookUrl) return "Awaiting first event";
  if (c.config.autoSync) return "Automatic sync";
  return "Manual sync";
}
function activityResult(value: string | null) {
  if (!value) return "";
  try { const data = JSON.parse(value); if (data.conceptMatches != null || data.alerts != null) { const parts = []; if (data.conceptMatches != null) parts.push(`${data.conceptMatches} concept match${data.conceptMatches === 1 ? "" : "es"}`); if (data.alerts != null) parts.push(`${data.alerts} alert${data.alerts === 1 ? "" : "s"}`); if (data.skipped) parts.push(data.skipped); return parts.join(" · "); } return data.exportedCall ? "Call export delivered" : data.updatedProperties ? "HubSpot properties updated" : data.exported ? "Coaching task created" : data.sent ? "Channel message sent" : data.updated !== undefined ? `${data.updated} records updated` : data.imported !== undefined ? `${data.imported} ${data.complete ? "items processed" : "items queued"}` : data.deleted ? "Previously deleted call skipped" : data.inserted ? "Call imported" : data.evaluated ? "Coaching complete" : data.callId ? "Call already imported" : data.skipped || "Complete"; } catch { return "Complete"; }
}

export default function IntegrationHub({ initial, providerId }: { initial: IntegrationData; providerId?: ProviderId }) {
  const [data, setData] = useState(initial); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const [query, setQuery] = useState(""); const [category, setCategory] = useState("All tools"); const [feeds, setFeeds] = useState<Record<string, Feed>>({}); const [refreshError, setRefreshError] = useState("");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected")) setMessage(params.get("connected") === "setup" ? "Account connected. Choose a task destination below to finish setup." : params.get("sync") === "held" ? "Connected. Turn on email capture in Admin settings to import messages." : providerId && isNotificationTool(providerId) ? "Channel connected. Enable your preferred alerts below." : "Connected. Your first import is queued.");
    if (params.get("connectionError")) setError(params.get("connectionError")!);
    if (params.has("connected") || params.has("connectionError")) window.history.replaceState(null, "", window.location.pathname);
  }, []);
  const refresh = useCallback(async () => setData(await request("/api/integrations")), []);
  useEffect(() => {
    const timer = setInterval(() => { if (!document.hidden) refresh().then(() => setRefreshError("")).catch(e => setRefreshError(e.message)); }, 10000);
    return () => clearInterval(timer);
  }, [refresh]);
  const run = async (fn: () => Promise<any>, success: string) => {
    setBusy(true); setError(""); setMessage("");
    try { const result = await fn(); await refresh(); setMessage(result?.warning ? `${success} ${result.warning}` : success); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const beginOAuth = async (provider: OAuthProvider, form?: HTMLFormElement) => {
    setBusy(true); setError(""); setMessage("");
    try {
      const fields = form ? new FormData(form) : undefined;
      const result = await request(`/api/integrations/oauth/${provider}/start`, { name: fields?.get("name") || integrationTool(provider)?.name, autoSync: fields ? fields.get("autoSync") === "on" : true });
      window.location.assign(result.url);
    } catch (e) { setError((e as Error).message); setBusy(false); }
  };
  const copy = async (value: string) => { try { await navigator.clipboard.writeText(value); setMessage("Copied."); } catch { setError("Copy is unavailable in this browser. Select and copy the text instead."); } };
  const tool = providerId ? integrationTool(providerId) : undefined;
  const capabilities = tool ? integrationCapabilities(tool.id) : undefined;
  const connections = data.connections.filter(c => !providerId || c.provider === providerId);
  const jobs = data.jobs.filter(j => !providerId || connections.some(c => c.id === j.connectionId));
  const filtered = INTEGRATION_TOOLS.filter(t => (category === "All tools" || t.category === category) && `${t.name} ${t.description}`.toLowerCase().includes(query.toLowerCase()));
  const enableFeed = (c: Connection, webhookSecret?: string) => run(async () => {
    const feed = await request(`/api/integrations/${c.id}`, { action: "webhook", webhookSecret });
    setFeeds(old => ({ ...old, [c.id]: feed }));
  }, (c.provider === "fathom" || c.provider === "aircall") ? `${integrationTool(c.provider)!.name} live feed is ready.` : "Feed details are ready. Finish setup in your tool to start receiving events.");

  return <div className="space-y-6">
    <Notice error={error || refreshError} message={message} />
    {!tool ? <>
      <section className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-indigo-50 px-6 py-6 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-5"><div className="max-w-xl"><div className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#007AFF]"><Radio size={14} /> Built around your calls</div><h2 className="text-xl font-semibold tracking-tight text-[#1d1d1f]">Your next coaching conversation starts here.</h2><p className="mt-2 text-sm leading-6 text-[#6e6e73]">Connect the tools your team already uses. Bring in processed calls, add CRM and meeting context, and send coaching follow-ups to your task tools.</p></div><div className="flex gap-6 rounded-xl border border-white bg-white/80 p-4 text-center"><div><p className="text-2xl font-semibold">{INTEGRATION_TOOLS.length}</p><p className="text-xs text-[#86868b]">Available tools</p></div><div><p className="text-2xl font-semibold text-[#007AFF]">{new Set(data.connections.map(c => c.provider)).size}</p><p className="text-xs text-[#86868b]">Connected</p></div></div></div>
        <div className="mt-5 flex flex-wrap gap-3">{["fathom", "hubspot"].map(id => <Link key={id} href={`/admin/integrations/${id}`} className="inline-flex items-center gap-2 rounded-lg border border-blue-100 bg-white px-3 py-2 text-xs font-medium text-[#007AFF] hover:bg-blue-50">{integrationTool(id)!.name} live feed <ArrowRight size={13} /></Link>)}</div>
      </section>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div className="flex flex-wrap gap-1 rounded-xl bg-black/[.035] p-1" aria-label="Filter integrations">{["All tools", "Calls", "CRM", "Meetings", "Email", "Tasks", "Notifications", "Automation"].map(value => <button key={value} aria-pressed={category === value} onClick={() => setCategory(value)} className={`rounded-lg px-3 py-2 text-sm transition ${category === value ? "bg-white font-medium text-[#1d1d1f] shadow-sm" : "text-[#6e6e73] hover:text-[#1d1d1f]"}`}>{value}</button>)}</div><label className="relative sm:w-64"><Search className="absolute left-3 top-2.5 text-[#86868b]" size={16} /><input aria-label="Search integrations" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Find your tool…" className={fieldClass + " pl-9"} /></label></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{filtered.map(t => {
        const connected = data.connections.filter(c => c.provider === t.id); const attention = connected.some(c => c.status === "error" || c.config.webhookError);
        return <div key={t.id} className="group flex min-h-[215px] flex-col rounded-2xl border border-black/[.08] bg-white p-5 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-100/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          <div className="flex items-center justify-between gap-2"><IntegrationLogo provider={t.id} /><span className="rounded-full bg-[#F5F5F7] px-2 py-1 text-[11px] font-medium text-[#6e6e73]">{t.category}</span></div>
          <h3 className="mt-4 font-semibold text-[#1d1d1f]"><Link href={`/admin/integrations/${t.id}`}>{t.name}</Link></h3><p className="mt-1 flex-1 text-xs leading-5 text-[#6e6e73]">{t.description}</p>
          <div className="mt-4 flex items-center justify-between border-t border-black/[.04] pt-3 text-xs"><span className={attention ? "text-amber-700" : connected.length ? "text-emerald-700" : "text-[#86868b]"}>{attention ? "Needs attention" : connected.length ? <span className="inline-flex items-center gap-1"><Check size={12} /> Connected</span> : t.category === "Notifications" ? "Coaching alerts" : t.live !== "none" ? "Live feed available" : "Automatic sync"}</span><Link href={`/admin/integrations/${t.id}`} className="inline-flex items-center gap-1 font-medium text-[#007AFF]">{connected.length ? "Manage" : t.oauth ? "Details" : "Connect"}<ArrowRight size={13} className="transition group-hover:translate-x-0.5" /></Link></div>
          {t.oauth && <div className="mt-3 space-y-2"><button type="button" className={buttonClass + " w-full"} disabled={busy || !data.oauth?.[t.oauth]} onClick={() => beginOAuth(t.oauth!)}>{busy ? "Connecting…" : oauthButtonLabel(t.oauth)}</button>{!data.oauth?.[t.oauth] && <p className="text-[11px] leading-4 text-[#86868b]">Account sign-in hasn’t been enabled yet.</p>}</div>}
        </div>;
      })}</div>
      {!filtered.length && <Card><p className="text-sm text-[#6e6e73]">No tools match your search.</p><button className={secondaryClass} onClick={() => { setQuery(""); setCategory("All tools"); }}>Show all tools</button></Card>}
    </> : <>
      <Link href="/admin/integrations" className="inline-flex items-center gap-2 text-sm text-[#6e6e73] hover:text-[#007AFF]"><ArrowLeft size={16} /> All integrations</Link>
      <Card><div className="flex items-start gap-4"><IntegrationLogo provider={tool.id} large /><div><span className="text-xs font-medium text-[#86868b]">{tool.category} integration</span><h1 className="mt-1 text-2xl font-semibold tracking-tight">Connect {tool.name}</h1><p className="mt-2 text-sm leading-6 text-[#6e6e73]">{tool.description}</p></div></div>
        <details open={!tool.oauth}><summary className="cursor-pointer text-sm font-medium">Connection help</summary><ol className="mt-4 space-y-3 border-t border-black/[.06] pt-5">{tool.steps.map((step, i) => <li key={step} className="flex items-start gap-3 text-sm leading-6 text-[#6e6e73]"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-[#007AFF]">{i + 1}</span>{step}</li>)}</ol></details>
        {tool.verification && <div className="rounded-xl bg-blue-50 p-4 text-sm leading-6"><p className="font-medium text-[#1d1d1f]">Check that it works</p><p className="mt-1 text-[#6e6e73]">{tool.verification}</p></div>}
        {tool.troubleshooting && <details className="rounded-xl border border-black/[.08] p-4 text-sm"><summary className="cursor-pointer font-medium">Help with common connection problems</summary><dl className="mt-4 space-y-4">{tool.troubleshooting.map(item => <div key={item.issue}><dt className="font-medium">{item.issue}</dt><dd className="mt-1 leading-6 text-[#6e6e73]">{item.fix}</dd></div>)}</dl></details>}
        <div className="flex flex-wrap gap-4 text-xs"><a href={tool.settings} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#007AFF]">Open {tool.name} <ExternalLink size={12} /></a><a href={tool.docs} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#007AFF]">Connection guide <ExternalLink size={12} /></a></div>
      </Card>
      {capabilities && <Card title="What you can do"><ul className="space-y-2">{capabilities.features.map(feature => <li key={feature} className="flex gap-2 text-sm text-[#6e6e73]"><Check size={16} className="mt-0.5 shrink-0 text-emerald-600" />{feature}</li>)}</ul><p className="text-xs leading-5 text-[#86868b]">{capabilities.scope}</p></Card>}
      <Card title={connections.length ? "Add another connection" : "Set up your connection"}>
        {tool.oauth && <form className="space-y-4" onSubmit={e => { e.preventDefault(); beginOAuth(tool.oauth!, e.currentTarget); }}>
          <p className="text-sm text-[#6e6e73]">{tool.category === "Tasks" ? "Sign in, approve access, then choose your task destination." : tool.category === "Notifications" ? "Sign in and choose your coaching channel. Alerts start off." : "Sign in and approve access. We’ll connect your account and start your first import."}</p>
          <div className="flex flex-wrap items-center gap-3"><button className={buttonClass} disabled={busy || !data.oauth?.[tool.oauth]}>{busy ? "Connecting…" : oauthButtonLabel(tool.oauth)}</button><span className="inline-flex items-center gap-1.5 text-xs text-[#86868b]"><ShieldCheck size={14} /> No API key needed</span></div>
          {!data.oauth?.[tool.oauth] && <p className="text-sm text-amber-800">Account sign-in hasn’t been enabled for {tool.name} on this installation. Your app administrator needs to enable it.{tool.fields.length > 0 ? " You can use manual setup below in the meantime." : ""}</p>}
          <details className="text-sm"><summary className="cursor-pointer text-[#6e6e73]">Connection preferences</summary><div className="mt-3 space-y-3"><label className="block space-y-1">Connection name<input name="name" defaultValue={tool.name} maxLength={200} className={fieldClass} /></label>{tool.syncMinutes > 0 && <label className="flex items-center gap-2"><input type="checkbox" name="autoSync" defaultChecked /> Sync automatically</label>}</div></details>
        </form>}
        {tool.fields.length > 0 || !tool.oauth ? <details open={!tool.oauth}><summary className="cursor-pointer text-sm font-medium">{tool.oauth ? "Connect with an API key or webhook instead" : "Connection details"}</summary>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={e => {
          e.preventDefault(); const form = e.currentTarget; const f = new FormData(form);
          run(async () => { const result = await request("/api/integrations", { ...Object.fromEntries(f), provider: tool.id, defaultStage: f.get("stage") || "First Discovery", autoSync: f.get("autoSync") === "on", autoEvaluate: f.get("autoEvaluate") === "on" }); if (result.feed) setFeeds(old => ({ ...old, [result.id]: result.feed })); form.reset(); return result; }, tool.syncMinutes ? `${tool.name} connected. Your first import is queued.` : isNotificationTool(tool.id) ? `${tool.name} connected. Enable your preferred alerts below.` : `${tool.name} connection created. Use the feed details below to send calls.`);
        }}>
          <label className="text-sm space-y-1">Connection name<input name="name" required defaultValue={tool.name} className={fieldClass} maxLength={200} /></label>
          {tool.fields.map(field => <label key={field.name} className="text-sm space-y-1">{field.label}<input name={field.name} required={field.required} type={field.type || "password"} autoComplete="off" className={fieldClass} maxLength={4096} placeholder={field.placeholder} /></label>)}
          {tool.id === "hubspot" && <label className="text-sm space-y-1">App client secret <span className="text-xs text-[#86868b]">(for live events)</span><input name="webhookSecret" type="password" autoComplete="off" className={fieldClass} maxLength={4096} placeholder="Optional — add now or after connecting" /></label>}
          {isCallTool(tool.id) && <label className="text-sm space-y-1">Default call stage<input name="stage" defaultValue="First Discovery" className={fieldClass} maxLength={100} required /></label>}
          <div className="space-y-3 text-sm sm:col-span-2">{tool.syncMinutes > 0 && <label className="flex gap-2 items-center"><input name="autoSync" type="checkbox" defaultChecked /> Sync automatically every {tool.syncMinutes === 60 ? "hour" : `${tool.syncMinutes} minutes`}</label>}{isCallTool(tool.id) && <label className="flex items-start gap-2"><input name="autoEvaluate" type="checkbox" className="mt-1" /><span>Automatically coach new calls<span className="mt-0.5 block text-xs text-[#86868b]">Uses your configured AI provider and evaluation allowance.</span></span></label>}</div>
          <div className="sm:col-span-2 flex flex-wrap items-center gap-4"><button disabled={busy} className={buttonClass}>{busy ? "Connecting…" : tool.syncMinutes || isNotificationTool(tool.id) ? `Connect ${tool.name}` : "Create call feed"}</button><span className="inline-flex items-center gap-1.5 text-xs text-[#86868b]"><ShieldCheck size={14} /> Credentials stored securely</span></div>
        </form></details> : null}<p className="text-xs leading-5 text-[#86868b]">{tool.note}</p>
      </Card>
    </>}

    <Card title={tool ? `${tool.name} connections` : "Connected tools"}>
      {!connections.length && <p className="text-sm text-[#86868b]">{tool ? `No ${tool.name} connections yet. Follow the steps above to get started.` : "Your connected tools and live feed status will appear here."}</p>}
      {connections.map(c => {
        const t = integrationTool(c.provider)!; const feed = feeds[c.id]; const automation = t.category === "Automation";
        return <div key={c.id} className="space-y-4 border-b border-black/[.08] pb-5 last:border-0 last:pb-0">
          <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-center gap-3"><IntegrationLogo provider={c.provider} /><div><Link href={`/admin/integrations/${c.provider}`} className="font-medium hover:text-[#007AFF]">{c.name}</Link><p className="mt-1 text-xs text-[#86868b]">{t.name} · {c.lastSyncedAt ? `Last sync ${new Date(c.lastSyncedAt).toLocaleString()}` : isNotificationTool(c.provider) ? c.config.lastNotifiedAt ? `Last alert ${new Date(c.config.lastNotifiedAt).toLocaleString()}` : "No messages sent yet" : automation ? "Waiting for a completed call" : c.config.pendingSetup ? "Account connected · choose a destination" : "First import pending"}</p></div></div><span className={`rounded-full px-2.5 py-1 text-xs ${c.status === "error" ? "bg-red-50 text-red-700" : c.config.lastWebhookAt ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}>{c.status === "error" ? "Needs attention" : c.status === "syncing" ? "Importing history" : liveStatus(c)}</span></div>
          {c.lastError && <p className="text-sm text-red-700">{c.lastError}</p>}
          {c.config.webhookError && <p className="rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-800">{c.config.webhookError}</p>}
          <div className="flex flex-wrap gap-2">{t.syncMinutes > 0 && !c.config.pendingSetup && <><button disabled={busy} className={secondaryClass} onClick={() => run(() => request(`/api/integrations/${c.id}`, { action: "sync" }), "Sync queued.")}>Sync now</button><button disabled={busy} className={secondaryClass} onClick={() => run(() => request(`/api/integrations/${c.id}`, { action: "sync", full: true }), t.id === "microsoft-teams" ? "History import queued for the last 30 days. Existing meetings are deduplicated." : t.category === "Meetings" ? "Meeting history import queued. The past window expands to two years." : "Full history import queued. Existing records are deduplicated.")}>Import history</button></>}{t.live !== "none" && c.provider !== "hubspot" && <button disabled={busy} className={secondaryClass} onClick={() => enableFeed(c)}>{(c.provider === "fathom" || c.provider === "aircall") ? c.config.webhookId ? "Check live feed" : "Enable live feed" : "Show feed details"}</button>}<button disabled={busy} className="px-2 text-xs text-red-600" onClick={() => { if (confirm(`Disconnect ${c.name}? Imported records will remain.`)) run(() => request(`/api/integrations/${c.id}`, {}, "DELETE"), "Disconnected."); }}>Disconnect</button></div>
          {tool?.id === "hubspot" && <form className="flex flex-col gap-2 sm:flex-row" onSubmit={e => { e.preventDefault(); const form = e.currentTarget; const secret = String(new FormData(form).get("secret") || ""); enableFeed(c, secret || undefined); form.reset(); }}><label className="flex-1"><span className="sr-only">HubSpot app client secret</span><input name="secret" type="password" autoComplete="off" className={fieldClass} placeholder={c.config.webhookUrl ? "Client secret saved — leave blank to use it" : "App client secret for live deal updates"} maxLength={4096} required={!c.config.webhookUrl} /></label><button disabled={busy} className={secondaryClass}>{c.config.webhookUrl ? "Show live feed setup" : "Set up live events"}</button></form>}
          {tool?.category === "Notifications" && <form className="space-y-3 rounded-xl bg-[#F5F5F7] p-4" onSubmit={e => {
            e.preventDefault(); const f = new FormData(e.currentTarget);
            run(() => request(`/api/integrations/${c.id}`, { action: "configure", ...c.config, notifyReviewed: f.get("notifyReviewed") === "on", notifyClips: f.get("notifyClips") === "on", notifyLowScore: f.get("notifyLowScore") === "on", lowScoreThreshold: Number(f.get("lowScoreThreshold")) }), "Alert preferences saved.");
          }}>
            <h4 className="text-sm font-medium">Choose coaching alerts</h4>
            <label className="flex items-center gap-2 text-sm"><input name="notifyReviewed" type="checkbox" defaultChecked={c.config.notifyReviewed} />Reviewed calls and coaching summaries</label>
            <label className="flex items-center gap-2 text-sm"><input name="notifyClips" type="checkbox" defaultChecked={c.config.notifyClips} />New coaching clips</label>
            <label className="flex items-center gap-2 text-sm"><input name="notifyLowScore" type="checkbox" defaultChecked={c.config.notifyLowScore} />Calls with a low script adherence score</label>
            <label className="block max-w-xs text-xs space-y-1">Alert when the score is below (1–10)<input name="lowScoreThreshold" type="number" min={1} max={10} required defaultValue={c.config.lowScoreThreshold || 5} className={fieldClass} /></label>
            <p className="text-xs text-[#6e6e73]">These messages share coaching summaries with the selected channel. Alert streams on Conversations can also deliver tracker, keyword, score, and deal-stage matches here without these checkboxes. The background worker delivers alerts and retries failures.</p>
            <div className="flex flex-wrap gap-2"><button disabled={busy} className={buttonClass}>Save alerts</button><button type="button" disabled={busy} className={secondaryClass} onClick={() => run(() => request(`/api/integrations/${c.id}`, { action: "test" }), "Test message queued. Check recent activity for delivery.")}>Send test message</button></div>
          </form>}
          {tool?.category === "CRM" && <div className="space-y-3 rounded-xl bg-[#F5F5F7] p-4"><h4 className="text-sm font-medium">Export reviewed calls</h4><p className="text-xs leading-5 text-[#6e6e73]">Add a note with the call summary, coaching score, next steps, and link to its matched deal timeline (or matched contacts/companies when no deal is linked). Give your connection note creation permission before enabling this.</p><label className="flex gap-2 text-sm"><input type="checkbox" disabled={busy} checked={c.config.exportReviewed === true} onChange={e => run(() => request(`/api/integrations/${c.id}`, { action: "configure", ...c.config, exportReviewed: e.target.checked }), "CRM export preference saved.")} />Export when a manager marks a call reviewed</label></div>}
          {c.provider === "hubspot" && <HubspotPropertyMapping connectionId={c.id} mappings={c.config.propertyMappings || []} enabled={c.config.writePropertiesOnReview === true} disabled={busy} onSave={body => run(() => request(`/api/integrations/${c.id}/properties`, body), "HubSpot property mapping saved.")} />}
          {tool?.category === "Automation" && <form className="space-y-3 rounded-xl bg-[#F5F5F7] p-4" onSubmit={e => {
            e.preventDefault(); const form = e.currentTarget; const f = new FormData(form);
            run(async () => { await request(`/api/integrations/${c.id}`, { action: "destination", outboundWebhookUrl: f.get("outboundWebhookUrl"), outboundOnImported: f.get("outboundOnImported") === "on", outboundOnReviewed: f.get("outboundOnReviewed") === "on" }); form.reset(); }, "Outbound destination saved.");
          }}><h4 className="text-sm font-medium">Send calls to {t.name}</h4><p className="text-xs leading-5 text-[#6e6e73]">{c.config.outboundConfigured ? "A destination is saved securely. Paste a new URL to replace it." : c.provider === "zapier" ? "Create a Zap using Webhooks by Zapier → Catch Hook, then paste its URL." : "Create a scenario using Webhooks → Custom webhook, then paste its URL."} The event contains the call summary, next steps, coaching score, and call link. Use eventId to deduplicate before creating records.</p><label className="block text-xs space-y-1">Outbound catch webhook URL<input name="outboundWebhookUrl" required type="password" autoComplete="off" className={fieldClass} maxLength={4096} /></label><label className="flex gap-2 text-sm"><input name="outboundOnImported" type="checkbox" defaultChecked={c.config.outboundOnImported} />Send newly imported calls</label><label className="flex gap-2 text-sm"><input name="outboundOnReviewed" type="checkbox" defaultChecked={c.config.outboundOnReviewed} />Send calls when reviewed</label><button disabled={busy} className={secondaryClass}>Save outbound destination</button>{c.config.outboundConfigured && <div className="flex flex-wrap gap-3 text-xs"><label className="flex gap-2"><input type="checkbox" checked={c.config.outboundOnImported === true} disabled={busy} onChange={e => run(() => request(`/api/integrations/${c.id}`, { action: "configure", ...c.config, outboundOnImported: e.target.checked }), "Imported-call trigger saved.")} />Imported-call trigger</label><label className="flex gap-2"><input type="checkbox" checked={c.config.outboundOnReviewed === true} disabled={busy} onChange={e => run(() => request(`/api/integrations/${c.id}`, { action: "configure", ...c.config, outboundOnReviewed: e.target.checked }), "Reviewed-call trigger saved.")} />Reviewed-call trigger</label></div>}</form>}
          {(tool?.category === "CRM" || tool?.category === "Automation") && <IntegrationDeliveries connectionId={c.id} />}
          {tool?.category === "Meetings" && <IntegrationMeetings connectionId={c.id} />}
          {c.config.pendingSetup && <IntegrationDestinationSetup connectionId={c.id} tool={t} onComplete={refresh} />}
          {tool?.category === "Tasks" && !c.config.pendingSetup && <IntegrationTasks connectionId={c.id} providerName={t.name} targetLabel={c.config.targetLabel} />}
          {c.config.lastWebhookAt && <p className="text-xs text-emerald-700">Last live event {new Date(c.config.lastWebhookAt).toLocaleString()}</p>}
          {feed && <div className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
            <h4 className="text-sm font-medium">{(c.provider === "fathom" || c.provider === "aircall") ? `Live feed registered in ${t.name}` : "Finish setup in " + t.name}</h4>
            <label className="block text-xs space-y-1">Feed URL<div className="flex gap-2"><input readOnly value={feed.url} className={fieldClass} onFocus={e => e.target.select()} /><button type="button" aria-label="Copy feed URL" className={secondaryClass} onClick={() => copy(feed.url)}><Copy size={14} /></button></div></label>
            {feed.token && <label className="block text-xs space-y-1">{c.provider === "fireflies" ? "Signing secret — paste into Fireflies" : "Authorization header — paste into your request"}<div className="flex gap-2"><input readOnly type="password" value={c.provider === "fireflies" ? feed.token : `Bearer ${feed.token}`} className={fieldClass} onFocus={e => e.target.select()} /><button type="button" aria-label="Copy feed credential" className={secondaryClass} onClick={() => copy(c.provider === "fireflies" ? feed.token! : `Bearer ${feed.token}`)}><Copy size={14} /></button></div></label>}
            {c.provider === "hubspot" && <p className="text-xs leading-5 text-[#6e6e73]">In your HubSpot app, set this as the webhook target URL. Subscribe to deal creation, deletion, and property changes for dealstage, amount, dealname, closedate, pipeline, and hubspot_owner_id. Add contact/company events to keep call matching current. This feed accepts events from account {c.config.portalId}.</p>}
            {c.provider === "fireflies" && <p className="text-xs leading-5 text-[#6e6e73]">In Fireflies Webhooks V2, enter this URL and signing secret. Select meeting.transcribed and meeting.summarized, save, then send a test event.</p>}
            {automation && <><p className="text-xs leading-5 text-[#6e6e73]">Send a POST request with Content-Type: application/json and the Authorization header above. Map your source’s values into this example. Keep externalId identical when retrying the same call.</p><div className="flex items-center justify-between text-xs"><span className="font-medium">Example call</span><button className={secondaryClass} onClick={() => copy(SAMPLE_CALL)}>Copy example</button></div><pre className="overflow-auto rounded-lg bg-white p-3 text-xs leading-5 text-[#6e6e73]">{SAMPLE_CALL}</pre></>}
          </div>}
          <div className="flex flex-wrap gap-4 text-xs">{t.syncMinutes > 0 && <label className="flex gap-2"><input type="checkbox" disabled={busy} checked={c.config.autoSync} onChange={e => run(() => request(`/api/integrations/${c.id}`, { action: "configure", ...c.config, autoSync: e.target.checked }), "Sync preference saved.")} />Automatic sync</label>}{isCallTool(c.provider) && <label className="flex gap-2"><input type="checkbox" disabled={busy} checked={c.config.autoEvaluate} onChange={e => run(() => request(`/api/integrations/${c.id}`, { action: "configure", ...c.config, autoEvaluate: e.target.checked }), "Coaching preference saved.")} />Automatic coaching</label>}</div>
        </div>;
      })}
    </Card>
    {data.connections.length > 0 && <Card title="Recent activity"><div className="flex flex-wrap justify-between gap-3"><p className="max-w-lg text-xs leading-5 text-[#86868b]">Live events are processed on arrival. History imports and automatic sync continue in the background. Activity refreshes every 10 seconds.</p><div className="flex gap-2"><button className={secondaryClass} disabled={busy} onClick={() => run(() => request("/api/jobs", {}), "Pending jobs processed.")}>Process pending</button><button className={secondaryClass} disabled={busy} onClick={() => run(refresh, "Activity refreshed.")}>Refresh</button></div></div>
      <div className="space-y-2">{jobs.length ? jobs.map(j => <div key={j.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[#F5F5F7] p-3 text-xs"><div><strong>{JOB_NAMES[j.kind] || j.kind}</strong><span className="text-[#86868b]"> · {data.connections.find(c => c.id === j.connectionId)?.name || (j.kind === "scan-alerts" ? "Concept trackers" : "Connection")} · {j.status}</span>{j.result && <p className="mt-1 text-[#6e6e73]">{activityResult(j.result)}</p>}{j.lastError && <p className="mt-1 text-red-600">{j.lastError}</p>}</div>{j.status === "failed" && j.kind !== "export-task" && j.kind !== "export-call" && j.kind !== "write-crm-properties" && <button disabled={busy} className={secondaryClass} onClick={() => run(() => request("/api/jobs", { id: j.id }), "Retry queued.")}>Retry</button>}</div>) : <p className="text-sm text-[#86868b]">No activity yet.</p>}</div>
    </Card>}
  </div>;
}

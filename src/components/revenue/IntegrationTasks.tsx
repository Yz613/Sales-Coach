"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { request, fieldClass, buttonClass } from "./ui";

type Task = { id: string; title: string; status: string; assignee: string; dueAt: string | null; sourceUrl: string | null; callId: string | null };
type Action = { id: string; description: string; callId: string; callTitle: string };
type Delivery = { id: string; callId: string; actionId: string; title: string; status: string; sourceUrl: string | null; lastError: string | null };
type Data = { tasks: Task[]; actionItems: Action[]; exports: Delivery[] };
export default function IntegrationTasks({ connectionId, providerName, targetLabel }: { connectionId: string; providerName: string; targetLabel?: string }) {
  const [data, setData] = useState<Data>({ tasks: [], actionItems: [], exports: [] }); const [selected, setSelected] = useState("");
  const [status, setStatus] = useState("all"); const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false);
  const endpoint = `/api/integrations/${connectionId}/tasks`;
  const refresh = useCallback(() => request(endpoint) as Promise<Data>, [endpoint]);
  useEffect(() => {
    let active = true;
    const load = () => refresh().then(value => { if (active) { setData(value); setError(""); } }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    load(); const timer = setInterval(() => { if (!document.hidden) load(); }, 10000);
    return () => { active = false; clearInterval(timer); };
  }, [refresh]);
  const send = async (body: object) => {
    setBusy(true); setError(""); setMessage("");
    try { await request(endpoint, body); setData(await refresh()); setSelected(""); setMessage("Task delivery queued. Check the delivery status below."); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const chosen = data.actionItems.find(item => `${item.callId}:${item.id}` === selected);
  const deliveryFor = (item: Action) => data.exports.find(delivery => delivery.callId === item.callId && delivery.actionId === item.id);
  return <section aria-label="Tasks and coaching follow-ups" className="space-y-4 rounded-xl bg-[#F5F5F7] p-4">
    <div><h4 className="text-sm font-medium">Tasks{targetLabel ? ` · ${targetLabel}` : ""}</h4><p className="mt-1 text-xs leading-5 text-[#6e6e73]">Sync your selected destination and send individual coaching action items to {providerName}.</p></div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}{message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
    <form className="space-y-3 rounded-lg bg-white p-3" onSubmit={e => { e.preventDefault(); if (chosen && !deliveryFor(chosen)) send({ action: "send", callId: chosen.callId, actionId: chosen.id }); }}>
      <label className="block text-sm space-y-1">Send a coaching action item<select required className={fieldClass} disabled={loading || busy} value={selected} onChange={e => setSelected(e.target.value)}><option value="">Choose an open action item</option>{data.actionItems.map(item => <option key={`${item.callId}:${item.id}`} value={`${item.callId}:${item.id}`} disabled={Boolean(deliveryFor(item))}>{item.callTitle} · {item.description.slice(0, 150)}{deliveryFor(item) ? ` (${deliveryFor(item)!.status})` : ""}</option>)}</select></label>
      <p className="text-xs leading-5 text-[#86868b]">This creates a new task visible to people with access to the destination. It shares the selected action and, where supported, a call title and link. It does not mark the action completed here.</p>
      <button className={buttonClass} disabled={busy || !chosen || Boolean(chosen && deliveryFor(chosen))}>{busy ? "Sending…" : "Send task"}</button>
      {!loading && !data.actionItems.length && <p className="text-xs text-[#86868b]">Add an action item to a call to send a coaching follow-up. Showing actions from the 100 most recent calls.</p>}
    </form>
    {data.exports.length > 0 && <div className="space-y-2"><h5 className="text-xs font-medium">Task deliveries</h5>{data.exports.map(delivery => <div key={delivery.id} className="space-y-1 rounded-lg bg-white p-3 text-xs"><p><strong>{delivery.title}</strong> · {delivery.status}</p>{delivery.lastError && <p className="leading-5 text-amber-800">{delivery.lastError}</p>}<div className="flex flex-wrap gap-3">{delivery.sourceUrl && <a href={delivery.sourceUrl} target="_blank" rel="noreferrer" className="text-[#007AFF]">Open task ↗</a>}<Link className="text-[#007AFF]" href={`/calls/${delivery.callId}`}>Open call →</Link>{["failed", "uncertain", "sending"].includes(delivery.status) && <button type="button" disabled={busy} className="text-amber-800 underline" onClick={() => { if (confirm("Check the destination first. Confirm that this task was not created, then retry?")) send({ action: "retry", exportId: delivery.id, confirmedMissing: true }); }}>Confirm no task exists and retry</button>}</div></div>)}</div>}
    <label className="block max-w-xs text-xs space-y-1">Show tasks<select className={fieldClass} value={status} onChange={e => setStatus(e.target.value)}>{["all", "open", "completed", "archived"].map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></label>
    {loading ? <p className="text-xs text-[#86868b]">Loading tasks…</p> : <div className="max-h-96 space-y-2 overflow-auto">{data.tasks.filter(task => status === "all" || task.status === status).map(task => <article key={task.id} className="space-y-1 rounded-lg bg-white p-3 text-sm"><p><strong>{task.title}</strong> <span className="text-xs text-[#86868b]">· {task.status}</span></p>{(task.assignee || task.dueAt) && <p className="text-xs text-[#86868b]">{task.assignee}{task.dueAt ? ` · Due ${new Date(task.dueAt.length === 10 ? `${task.dueAt}T12:00:00` : task.dueAt).toLocaleDateString()}` : ""}</p>}<div className="flex gap-3 text-xs text-[#007AFF]">{task.sourceUrl && <a href={task.sourceUrl} target="_blank" rel="noreferrer">Open source ↗</a>}{task.callId && <Link href={`/calls/${task.callId}`}>Coaching call →</Link>}</div></article>)}{!data.tasks.some(task => status === "all" || task.status === status) && <p className="text-xs text-[#86868b]">No tasks in this view. Use Sync now to refresh the destination.</p>}</div>}
    <p className="text-xs text-[#86868b]">Showing up to 100 tasks and deliveries. Task status is refreshed from the source; it does not change coaching completion.</p>
  </section>;
}

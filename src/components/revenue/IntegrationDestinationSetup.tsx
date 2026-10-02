"use client";
import { useCallback, useEffect, useState } from "react";
import type { IntegrationTool } from "@/lib/integrations/catalog";
import type { TaskDestination } from "@/lib/integrations/tasks";
import { buttonClass, fieldClass, Notice, request, secondaryClass } from "./ui";

type Page = { items: TaskDestination[]; nextCursor?: string };
export default function IntegrationDestinationSetup({ connectionId, tool, onComplete }: { connectionId: string; tool: IntegrationTool; onComplete: () => Promise<unknown> }) {
  const [page, setPage] = useState<Page>({ items: [] }); const [trail, setTrail] = useState<TaskDestination[]>([]);
  const [selected, setSelected] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [manual, setManual] = useState(false);
  const group = trail[trail.length - 1];
  const load = useCallback(async (cursor = "") => {
    setBusy(true); setError("");
    try {
      const params = new URLSearchParams({ group: group?.group || "", groupId: group?.id || "", cursor });
      const result: Page = await request(`/api/integrations/${connectionId}/destinations?${params}`);
      setPage(previous => cursor ? { ...result, items: [...previous.items, ...result.items] } : result); setSelected("");
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }, [connectionId, group]);
  useEffect(() => { load(); }, [load]);
  async function finish(fields: Record<string, string>) {
    setBusy(true); setError("");
    try { await request(`/api/integrations/${connectionId}/destinations`, fields); await onComplete(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <div className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
    <h4 className="text-sm font-medium">Account connected. Choose where coaching tasks go.</h4>
    <Notice error={error} />
    {!manual ? <>
      {trail.length > 0 && <div className="flex flex-wrap items-center gap-2 text-xs"><button className="text-[#007AFF]" disabled={busy} onClick={() => { setPage({ items: [] }); setTrail([]); }}>All destinations</button>{trail.map((item, index) => <button key={item.id} disabled={busy} className="text-[#007AFF]" onClick={() => { setPage({ items: [] }); setTrail(trail.slice(0, index + 1)); }}> / {item.label}</button>)}</div>}
      <label className="block space-y-1 text-sm">{group ? `Choose from ${group.label}` : "Available destinations"}<select className={fieldClass} disabled={busy} value={selected} onChange={e => setSelected(e.target.value)}><option value="">{busy ? "Loading…" : "Choose a destination"}</option>{page.items.map((item, index) => <option key={`${item.group || "target"}:${item.id}`} value={String(index)}>{item.label}{item.group ? " →" : ""}</option>)}</select></label>
      {!busy && !page.items.length && !error && <p className="text-xs text-[#6e6e73]">No destinations are available here. Check that your account has access, or choose another workspace.</p>}
      <div className="flex flex-wrap gap-2"><button className={buttonClass} disabled={busy || selected === ""} onClick={() => {
        const item = page.items[Number(selected)]; if (!item) return;
        if (item.group) { setSelected(""); setPage({ items: [] }); setTrail(previous => [...previous, item]); }
        else finish({ ...item.fields, targetId: item.id });
      }}>{selected !== "" && page.items[Number(selected)]?.group ? "Open" : "Use this destination"}</button>{page.nextCursor && <button disabled={busy} className={secondaryClass} onClick={() => load(page.nextCursor)}>Load more</button>}<button disabled={busy} className={secondaryClass} onClick={() => load()}>Refresh list</button></div>
    </> : <form className="grid gap-3 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); finish(Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>); }}>{tool.fields.filter(field => field.name !== "token").map(field => <label key={field.name} className="text-sm space-y-1">{field.label}<input name={field.name} required={field.required} className={fieldClass} maxLength={4096} /></label>)}<div><button className={buttonClass} disabled={busy}>Save destination</button></div></form>}
    <button className="text-xs text-[#007AFF]" disabled={busy} onClick={() => setManual(value => !value)}>{manual ? "Choose from my account" : "Enter a destination ID instead"}</button>
  </div>;
}

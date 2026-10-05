"use client";
import { useCallback, useEffect, useState } from "react";
import type { HubspotPropertyField, HubspotPropertyMapping } from "@/lib/revenue/types";
import { fieldClass, secondaryClass, request } from "./ui";

const FIELDS: { id: HubspotPropertyField; label: string }[] = [
  { id: "summary", label: "Coaching summary" },
  { id: "score", label: "Coaching score" },
  { id: "nextSteps", label: "Next steps" },
  { id: "forecastCategory", label: "Forecast category" },
];
const empty = (): HubspotPropertyMapping => ({ source: "summary", object: "deal", property: "" });

export default function HubspotPropertyMapping({ connectionId, mappings, enabled, disabled, onSave }: {
  connectionId: string; mappings: HubspotPropertyMapping[]; enabled: boolean; disabled: boolean;
  onSave: (body: { action: "save"; propertyMappings: HubspotPropertyMapping[]; writePropertiesOnReview: boolean }) => Promise<unknown>;
}) {
  const [rows, setRows] = useState<HubspotPropertyMapping[]>(mappings.length ? mappings : [empty()]);
  const [onReview, setOnReview] = useState(enabled);
  const [writes, setWrites] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    try { const data = await request(`/api/integrations/${connectionId}/properties`); setWrites(data.writes || []); setError(""); }
    catch (err) { setError((err as Error).message); }
  }, [connectionId]);
  useEffect(() => { refresh(); const timer = setInterval(() => { if (!document.hidden) refresh(); }, 10000); return () => clearInterval(timer); }, [refresh]);
  const update = (index: number, patch: Partial<HubspotPropertyMapping>) => setRows(current => current.map((row, rowIndex) => {
    if (rowIndex !== index) return row;
    const next = { ...row, ...patch };
    if (next.source === "forecastCategory") next.object = "deal";
    return next;
  }));
  const retry = async (id: string) => {
    if (!confirm("Check the HubSpot record first. Confirm that these property values were not updated before sending them again.")) return;
    setBusy(true); setError("");
    try { await request(`/api/integrations/${connectionId}/properties`, { action: "retry", writeId: id, confirmed: true }); await refresh(); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };
  return <form className="space-y-3 rounded-xl bg-[#F5F5F7] p-4" onSubmit={event => {
    event.preventDefault();
    const propertyMappings = rows.map(row => ({ ...row, property: row.property.trim() })).filter(row => row.property);
    onSave({ action: "save", propertyMappings, writePropertiesOnReview: onReview }).catch(() => undefined);
  }}>
    <h4 className="text-sm font-medium">Update HubSpot properties</h4>
    <p className="text-xs leading-5 text-[#6e6e73]">Map coaching summary, score, next steps, or forecast category to an existing deal or contact property. Create the property in HubSpot first and use its internal name. Score is a number from 0 to 10. Forecast category is written as Pipeline, Best case, Commit, or Omitted. The HubSpot property <span className="font-medium">hs_manual_forecast_category</span> receives PIPELINE, BEST_CASE, COMMIT, or OMIT. Deal updates need <span className="font-medium">crm.objects.deals.write</span>. Contact updates need <span className="font-medium">crm.objects.contacts.write</span>. Reconnect after adding those scopes. Members cannot send updates.</p>
    {rows.map((row, index) => <div key={index} className="grid gap-2 sm:grid-cols-[1fr_8rem_1fr_auto]">
      <label className="text-xs space-y-1">Coaching field<select aria-label="Coaching field" className={fieldClass} value={row.source} disabled={disabled} onChange={event => update(index, { source: event.target.value as HubspotPropertyField })}>{FIELDS.map(field => <option key={field.id} value={field.id}>{field.label}</option>)}</select></label>
      <label className="text-xs space-y-1">Record<select aria-label="HubSpot record type" className={fieldClass} value={row.object} disabled={disabled || row.source === "forecastCategory"} onChange={event => update(index, { object: event.target.value as "deal" | "contact" })}><option value="deal">Deal</option><option value="contact">Contact</option></select></label>
      <label className="text-xs space-y-1">HubSpot property<input aria-label="HubSpot property name" className={fieldClass} value={row.property} disabled={disabled} maxLength={100} placeholder="coaching_summary" onChange={event => update(index, { property: event.target.value })} /></label>
      <button type="button" className="self-end px-2 text-xs text-red-600" disabled={disabled || rows.length === 1 && !row.property} onClick={() => setRows(current => { const next = current.filter((_, rowIndex) => rowIndex !== index); return next.length ? next : [empty()]; })}>Remove</button>
    </div>)}
    <label className="flex gap-2 text-sm"><input type="checkbox" disabled={disabled} checked={onReview} onChange={event => setOnReview(event.target.checked)} />Update mapped properties when a manager marks a call reviewed or saves a deal forecast</label>
    <div className="flex flex-wrap gap-2">{rows.length < 8 && <button type="button" className={secondaryClass} disabled={disabled} onClick={() => setRows(current => [...current, empty()])}>Add property</button>}<button className={secondaryClass} disabled={disabled}>Save property mapping</button></div>
    <div className="space-y-2 border-t border-black/[.06] pt-3"><h5 className="text-xs font-medium">HubSpot property updates</h5><p className="text-xs text-[#6e6e73]">The same values are sent once. A changed review sends a new update. Uncertain deliveries stay paused until you check HubSpot and confirm a retry.</p>{error && <p role="alert" className="text-xs text-red-700">{error}</p>}{writes.length ? writes.slice(0, 20).map(write => <div key={write.id} className="rounded-lg bg-white p-3 text-xs"><div className="flex flex-wrap items-center justify-between gap-2"><span>{write.event === "deal.reviewed" ? "Deal review" : write.event === "manual" ? "Manual update" : "Call review"} · {write.status} · {Object.keys(write.properties || {}).join(", ") || "No properties"}</span>{write.canRetry && <button type="button" disabled={busy || disabled} className={secondaryClass} onClick={() => retry(write.id)}>Check HubSpot and retry</button>}</div>{write.lastError && <p className="mt-1 text-amber-800">{write.lastError}</p>}</div>) : <p className="text-xs text-[#86868b]">No property updates yet.</p>}</div>
  </form>;
}

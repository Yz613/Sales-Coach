"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { dealDetail } from "@/lib/revenue/forecast";
import { amountValue, CATEGORY_LABELS, FORECAST_CATEGORIES, MEDDICC, type DealReview, type Evidence, type PlaybookKey } from "@/lib/revenue/forecast-model";
import type { Segment } from "@/lib/revenue/types";
import { formatDuration } from "@/lib/utils";
import { buttonClass, Card, fieldClass, Notice, request, secondaryClass } from "./ui";
type Detail = Awaited<ReturnType<typeof dealDetail>>;

function EvidencePicker({ deal, onChoose, onClose }: { deal: Detail["deal"]; onChoose: (value: Evidence) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [callId, setCallId] = useState(deal.linkedCalls[0]?.id || "");
  const [segments, setSegments] = useState<Segment[]>([]); const [query, setQuery] = useState("");
  const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    let cancelled = false; setSegments([]); setError("");
    if (!callId) return;
    setLoading(true);
    request(`/api/deals/${encodeURIComponent(deal.id)}?callId=${encodeURIComponent(callId)}`).then(data => { if (!cancelled) setSegments(data.segments); })
      .catch(err => { if (!cancelled) setError(err.message); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [callId, deal.id]);
  const matches = segments.filter(s => s.text.toLowerCase().includes(query.toLowerCase()) || s.speaker.toLowerCase().includes(query.toLowerCase()));
  return <dialog ref={dialog} onCancel={e => { e.preventDefault(); onClose(); }} aria-label="Choose transcript evidence" className="w-[min(720px,calc(100%_-_2rem))] max-h-[85vh] rounded-2xl p-6 space-y-4 backdrop:bg-black/40">
    <div className="flex items-center justify-between gap-4"><h2 className="font-semibold">Choose transcript evidence</h2><button type="button" className={secondaryClass} onClick={onClose}>Close</button></div>
    <label className="block text-sm space-y-1">Linked conversation<select className={fieldClass} value={callId} onChange={e => setCallId(e.target.value)}>{deal.linkedCalls.map(call => <option key={call.id} value={call.id}>{call.title} · {call.createdAt.slice(0, 10)}</option>)}</select></label>
    <input className={fieldClass} aria-label="Search transcript evidence" placeholder="Search words or a speaker" value={query} onChange={e => setQuery(e.target.value)} />
    <Notice error={error} />
    {loading ? <p role="status" className="text-sm text-[#6e6e73]">Loading transcript…</p> : <div className="space-y-2 max-h-[45vh] overflow-y-auto">{matches.slice(0, 60).map((segment, i) => <button key={`${segment.start}-${i}`} type="button" className="block text-left w-full rounded-lg border border-black/10 p-3 hover:bg-blue-50 focus:ring-2 focus:ring-blue-300" onClick={() => { onChoose({ callId, start: segment.start, quote: segment.text }); onClose(); }}><span className="text-xs text-[#007AFF]">{segment.speaker} · {formatDuration(segment.start)}{segment.timing === "estimated" && " · Estimated time"}</span><p className="text-sm mt-1 whitespace-pre-wrap">{segment.text}</p></button>)}{!matches.length && <p className="text-sm text-[#6e6e73]">{deal.linkedCalls.length ? "No transcript moments match. Try another conversation or search." : "Link a conversation from its CRM context panel to add evidence."}</p>}{matches.length > 60 && <p className="text-xs text-[#86868b]">Showing 60 of {matches.length} moments. Search to narrow the list.</p>}</div>}
  </dialog>;
}

export default function DealWorkspace({ initial }: { initial: Detail }) {
  const [data, setData] = useState(initial); const [review, setReview] = useState<DealReview>(initial.deal.review);
  const [dirty, setDirty] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const [evidenceKey, setEvidenceKey] = useState<PlaybookKey | null>(null);
  const deal = data.deal;
  const amount = amountValue(deal.amount);
  function change(next: DealReview) { setReview(next); setDirty(true); setMessage(""); }
  async function save() {
    setBusy(true); setError(""); setMessage("");
    try { const result = await request(`/api/deals/${encodeURIComponent(deal.id)}`, review, "PUT"); setReview(result.deal.review); setData(result); setDirty(false); setMessage("Deal review saved. Forecast totals now use this category and probability."); }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  async function reload() {
    setBusy(true); setError("");
    try { const latest = await request(`/api/deals/${encodeURIComponent(deal.id)}`); setData(latest); setReview(latest.deal.review); setDirty(false); setMessage("Latest deal and review loaded."); }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  const confirmed = MEDDICC.filter(({ key }) => review.playbook[key].status === "confirmed").length;
  return <div className="space-y-5">
    <div className="flex flex-wrap justify-between gap-4"><div><h1 className="text-2xl font-semibold">{deal.name}</h1><p className="text-sm text-[#6e6e73] mt-1">{deal.stage || "No stage"} · {deal.owner || "Unassigned"} · {deal.closed ? deal.won ? "Won" : "Closed" : "Open"}{deal.closeDate && ` · Closes ${deal.closeDate.slice(0, 10)}`}</p></div><div className="text-right"><p className="text-xl font-semibold">{amount === null ? "Amount unavailable" : `${amount.toLocaleString()} ${deal.currency || "Unspecified currency"}`}</p><Link href="/forecast" className="text-sm text-[#007AFF]">Open forecast →</Link></div></div>
    <Notice error={error} message={message} />
    <div className="grid lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)] gap-5">
      <form className="space-y-5" onSubmit={e => { e.preventDefault(); void save(); }}>
        <Card title="Manager deal review"><fieldset disabled={busy} className="space-y-4"><div className="grid sm:grid-cols-2 gap-3"><label className="text-sm space-y-1">Forecast category<select className={fieldClass} value={review.category} onChange={e => change({ ...review, category: e.target.value as DealReview["category"] })}>{FORECAST_CATEGORIES.map(category => <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>)}</select></label><label className="text-sm space-y-1">Estimated win probability (%)<input className={fieldClass} type="number" min={0} max={100} step={1} placeholder="Not estimated" value={review.probability ?? ""} onChange={e => change({ ...review, probability: e.target.value === "" ? null : Number(e.target.value) })} /></label></div>
          <p className="text-xs text-[#86868b]">Manager estimates inform the weighted forecast. Closed results and deal amounts come from your CRM.</p>
          <label className="block text-sm space-y-1">Next step<textarea className={fieldClass} maxLength={2000} rows={2} placeholder="Confirm the security review with the buyer" value={review.nextStep} onChange={e => change({ ...review, nextStep: e.target.value })} /></label><label className="block text-sm space-y-1">Next step due date<input className={fieldClass} type="date" value={review.nextStepDate || ""} onChange={e => change({ ...review, nextStepDate: e.target.value || null })} /></label>
          {deal.closed && <p className="text-sm text-[#6e6e73]">This deal is closed. Its CRM outcome takes precedence over forecast categories and probabilities.</p>}
        </fieldset></Card>
        <Card title={`MEDDICC qualification · ${confirmed}/${MEDDICC.length} confirmed`}><p className="text-sm text-[#6e6e73]">Support each confirmed or missing item with a manager note or an exact moment from a linked conversation.</p><fieldset disabled={busy} className="space-y-5">{MEDDICC.map(({ key, label, prompt }) => {
          const item = review.playbook[key];
          return <div key={key} className="border-t border-black/[.06] pt-4 space-y-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">{label}</h3><p className="text-xs text-[#86868b] mt-1">{prompt}</p></div><select aria-label={`${label} status`} className={`${fieldClass} !w-auto`} value={item.status} onChange={e => change({ ...review, playbook: { ...review.playbook, [key]: { ...item, status: e.target.value } } })}><option value="unknown">Unknown</option><option value="confirmed">Confirmed</option><option value="missing">Missing / at risk</option></select></div><textarea aria-label={`${label} note`} className={fieldClass} rows={2} maxLength={2000} placeholder="What do we know, and what needs validating?" value={item.note} onChange={e => change({ ...review, playbook: { ...review.playbook, [key]: { ...item, note: e.target.value } } })} />
            {item.evidence && <div className="rounded-lg bg-blue-50 p-3 text-sm space-y-2"><blockquote className="whitespace-pre-wrap">“{item.evidence.quote}”</blockquote><div className="flex justify-between gap-3"><Link href={`/calls/${encodeURIComponent(item.evidence.callId)}#t-${Math.floor(item.evidence.start)}`} className="text-xs text-[#007AFF]">View evidence at {formatDuration(item.evidence.start)} →</Link><button type="button" className="text-xs text-red-600" onClick={() => change({ ...review, playbook: { ...review.playbook, [key]: { ...item, evidence: null } } })}>Remove</button></div></div>}
            <button type="button" className={secondaryClass} disabled={!deal.linkedCalls.length} onClick={() => setEvidenceKey(key)}>{item.evidence ? "Replace transcript evidence" : "Add transcript evidence"}</button></div>;
        })}</fieldset></Card>
        <div className="sticky bottom-20 md:bottom-4 rounded-xl border border-black/10 bg-white/95 p-4 flex flex-wrap items-center gap-3 shadow-sm"><button className={buttonClass} disabled={busy || !dirty}>{busy ? "Saving…" : "Save deal review"}</button><button type="button" className={secondaryClass} disabled={busy} onClick={() => void reload()}>{dirty ? "Discard edits & reload" : "Refresh deal"}</button><span className="text-xs text-[#86868b]">{dirty ? "Unsaved changes" : review.updatedAt ? `Reviewed ${new Date(review.updatedAt).toLocaleString()}` : "No manager review yet"}</span></div>
      </form>
      <aside className="space-y-5">
        <Card title="Activity flags">{deal.risks.map(risk => <p key={risk} className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{risk}</p>)}{!deal.risks.length && <p className="text-sm text-[#6e6e73]">No current activity flags.</p>}<p className="text-xs text-[#86868b]">Rule-based signals from conversations, close dates, and saved next steps.</p></Card>
        <Card title="Buyer engagement">{data.stakeholders.map(person => <div key={person.email || person.name} className="text-sm"><p className="font-medium">{person.name}</p>{person.email && <p className="text-xs text-[#86868b] break-all">{person.email}</p>}<p className="text-xs text-[#6e6e73]">{person.conversations} conversations · Last seen {person.lastSeen.slice(0, 10)}</p></div>)}{!data.stakeholders.length && <p className="text-sm text-[#6e6e73]">No external participants on linked conversations.</p>}<p className="text-xs text-[#86868b]">Calls linked through shared CRM contacts or companies may cover multiple deals.</p></Card>
        <Card title="Open call actions">{data.actions.map(action => <div key={`${action.callId}-${action.id}`} className="rounded-lg bg-[#F5F5F7] p-3 text-sm"><p>{action.description}</p>{action.assignee && <p className="text-xs text-[#86868b] mt-1">{action.assignee}</p>}<Link href={`/calls/${encodeURIComponent(action.callId)}${action.timestamp != null ? `#t-${Math.floor(action.timestamp)}` : ""}`} className="text-xs text-[#007AFF]">{action.callTitle} →</Link></div>)}{!data.actions.length && <p className="text-sm text-[#6e6e73]">No open call actions. Set a next step in the review.</p>}</Card>
      </aside>
    </div>
    <Card title="Conversation timeline">{data.timeline.map(call => <div key={call.id} className="border-l-2 border-blue-100 pl-4 py-2"><Link href={`/calls/${encodeURIComponent(call.id)}`} className="text-sm font-medium text-[#007AFF]">{call.title} →</Link><p className="text-xs text-[#86868b] mt-1">{new Date(call.createdAt).toLocaleString()} · {call.stage}</p>{call.summary && <p className="text-sm text-[#6e6e73] mt-2 whitespace-pre-wrap">{call.summary}</p>}</div>)}{!data.timeline.length && <p className="text-sm text-[#6e6e73]">Open a conversation and link this deal from its CRM context panel.</p>}</Card>
    {evidenceKey && <EvidencePicker deal={deal} onClose={() => setEvidenceKey(null)} onChoose={evidence => change({ ...review, playbook: { ...review.playbook, [evidenceKey]: { ...review.playbook[evidenceKey], evidence } } })} />}
  </div>;
}

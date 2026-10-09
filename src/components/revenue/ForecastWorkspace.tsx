"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import type { forecastWorkspace, ForecastSubmission } from "@/lib/revenue/forecast";
import { CATEGORY_LABELS, type CurrencyForecast } from "@/lib/revenue/forecast-model";
import { buttonClass, Card, fieldClass, Notice, request, secondaryClass } from "./ui";
import { BarChart, LiveChartPanel } from "@/components/charts/MetricCharts";
import { ChipSelect, joinChoice, splitChoice } from "@/components/forms/ChoiceControls";
type Workspace = Awaited<ReturnType<typeof forecastWorkspace>>;
const money = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 2 });
const NOTE_OPTIONS = ["Pulled in", "Slipped", "New logo", "Expansion", "At risk", "Commit changed"];
function periodChoices(now = new Date()) {
  const choices: { value: string; label: string }[] = [];
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  for (let i = 0; i < 6; i += 1) {
    const date = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + i, 1));
    const value = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    choices.push({ value, label: date.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }) });
  }
  const quarterStart = Math.floor(now.getUTCMonth() / 3);
  for (let i = 0; i < 4; i += 1) {
    const quarter = ((quarterStart + i) % 4) + 1;
    const year = now.getUTCFullYear() + Math.floor((quarterStart + i) / 4);
    choices.push({ value: `${year}-Q${quarter}`, label: `${year} Q${quarter}` });
  }
  return choices;
}
const delta = (value: number) => `${value > 0 ? "+" : ""}${money(Math.round(value * 100) / 100)}`;
function zero(currency: string): CurrencyForecast { return { currency, won: 0, pipeline: 0, bestCase: 0, commit: 0, omitted: 0, weighted: 0, committed: 0, upside: 0, open: 0, deals: 0, missingAmounts: 0, missingProbabilities: 0 }; }

export default function ForecastWorkspace({ initial, initialError = "" }: { initial: Workspace; initialError?: string }) {
  const [data, setData] = useState(initial); const [filters, setFilters] = useState(initial.filters);
  const [selected, setSelected] = useState<ForecastSubmission | null>(null);
  const [target, setTarget] = useState(initial.history[0]?.target || ""); const [notes, setNotes] = useState(""); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError); const [message, setMessage] = useState("");
  const requestId = useRef<string | null>(null);
  const snapshot = selected?.snapshot || data.snapshot;
  const latest = data.history[0];
  const currencies = [...new Set([...snapshot.totals.map(t => t.currency), ...(selected ? [] : latest?.snapshot.totals.map(t => t.currency) || [])])].sort();
  const effectiveTarget = selected?.target != null ? Number(selected.target) : selected ? null : target !== "" ? Number(target) : null;
  const committed = snapshot.totals.find(t => t.currency === data.filters.currency)?.committed || 0;
  const pendingFilters = JSON.stringify(filters) !== JSON.stringify(data.filters);
  const periods = periodChoices();
  const periodKnown = periods.some(choice => choice.value === filters.period);
  const [customPeriod, setCustomPeriod] = useState(!periodKnown);
  const notesChoice = splitChoice(notes, NOTE_OPTIONS);
  const chartCurrency = data.filters.currency || snapshot.totals[0]?.currency || "";
  const chartTotal = snapshot.totals.find(total => total.currency === chartCurrency);
  async function refresh() {
    setBusy(true); setError(""); setMessage("");
    try {
      const params = new URLSearchParams({ ...filters }); const result = await request(`/api/forecast?${params}`);
      setData(result); setFilters(result.filters); setSelected(null);
      if (pendingFilters) { setTarget(result.history[0]?.target || ""); setNotes(""); requestId.current = null; }
      window.history.replaceState(null, "", `${window.location.pathname}?${params}`);
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  async function submit() {
    setBusy(true); setError(""); setMessage("");
    requestId.current ||= crypto.randomUUID();
    try {
      const saved = await request("/api/forecast", { ...data.filters, requestId: requestId.current, target: target === "" ? null : Number(target), notes });
      setData(previous => ({ ...previous, history: [saved, ...previous.history.filter(h => h.id !== saved.id)].slice(0, 20), snapshot: saved.snapshot }));
      setSelected(null); requestId.current = null; setMessage("Forecast submitted. The saved snapshot will preserve these totals and deal categories.");
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  return <div className="space-y-5">
    <Card><form onSubmit={e => { e.preventDefault(); void refresh(); }}><fieldset disabled={busy} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end"><label className="text-sm space-y-1">Month or quarter<select aria-label="Forecast period" className={fieldClass} value={periodKnown && !customPeriod ? filters.period : "other"} onChange={e => { if (e.target.value === "other") { setCustomPeriod(true); return; } setCustomPeriod(false); setFilters({ ...filters, period: e.target.value }); }}><option value="other">Other period</option>{periods.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}{periodKnown ? null : <option value={filters.period}>{filters.period}</option>}</select>{customPeriod && <input aria-label="Custom forecast period" className={`${fieldClass} mt-2`} required maxLength={7} pattern="[0-9]{4}-(Q[1-4]|0[1-9]|1[0-2])" placeholder="2026-Q4 or 2026-10" value={filters.period} onChange={e => setFilters({ ...filters, period: e.target.value })} />}</label><label className="text-sm space-y-1">CRM owner<select className={fieldClass} value={filters.owner} onChange={e => setFilters({ ...filters, owner: e.target.value })}><option value="">All owners</option>{data.owners.map(owner => <option key={owner}>{owner}</option>)}</select></label><label className="text-sm space-y-1">Currency<select className={fieldClass} value={filters.currency} onChange={e => setFilters({ ...filters, currency: e.target.value })}><option value="">All currencies, kept separate</option>{data.currencies.map(currency => <option key={currency}>{currency}</option>)}</select></label><button className={secondaryClass}>{busy ? "Loading…" : pendingFilters ? "Apply filters" : "Refresh forecast"}</button></fieldset></form><p className="text-xs text-[#86868b]">Uses CRM close dates in the selected calendar period. Undated open deals and closed losses are excluded. Owner names or IDs follow the CRM.</p></Card>
    <Notice error={error} message={message} />
    {selected && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4"><p className="text-sm text-blue-900">Saved forecast · {new Date(selected.createdAt).toLocaleString()} · {selected.createdBy}</p><button className={secondaryClass} onClick={() => setSelected(null)}>Return to live forecast</button></div>}
    <Card title={selected ? `Submitted forecast · ${selected.period}` : `Live forecast · ${data.filters.period}`}>
      <div className="overflow-x-auto"><table className="w-full text-sm text-right whitespace-nowrap"><caption className="sr-only">Revenue forecast totals by currency</caption><thead><tr className="border-b border-black/10 text-xs text-[#86868b]"><th scope="col" className="py-3 pr-4 text-left">Currency</th><th scope="col" className="px-3">Won</th><th scope="col" className="px-3">Open pipeline</th><th scope="col" className="px-3">Committed</th><th scope="col" className="px-3">Upside</th><th scope="col" className="px-3">Weighted</th></tr></thead><tbody>{currencies.map(currency => { const total = snapshot.totals.find(t => t.currency === currency) || zero(currency); return <tr key={currency} className="border-b border-black/[.06]"><th scope="row" className="py-4 pr-4 text-left font-medium">{currency}</th><td className="px-3">{money(total.won)}</td><td className="px-3">{money(total.open)}</td><td className="px-3 font-semibold text-[#007AFF]">{money(total.committed)}</td><td className="px-3">{money(total.upside)}</td><td className="px-3">{money(total.weighted)}</td></tr>; })}</tbody></table></div>
      {!currencies.length && <p className="text-sm text-[#6e6e73]">No deals with a close date in this period. <Link href="/deals" className="text-[#007AFF]">Review the deal pipeline →</Link></p>}
      <p className="text-xs text-[#6e6e73]">Committed = won + commit. Upside = committed + best case. Weighted = won + open amounts × manager probability. Omitted deals are excluded from open and weighted totals.</p>
      {chartTotal && <BarChart bars={[{ label: "Won", value: chartTotal.won }, { label: "Pipeline", value: chartTotal.pipeline }, { label: "Best case", value: chartTotal.bestCase }, { label: "Commit", value: chartTotal.commit }, { label: "Omitted", value: chartTotal.omitted }, { label: "Weighted", value: chartTotal.weighted }]} />}
      <div className="flex flex-wrap gap-2">{snapshot.undatedDeals > 0 && <span className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-800">{snapshot.undatedDeals} open deals have no usable close date</span>}{snapshot.totals.map(total => <span key={total.currency} className="rounded-full bg-[#F5F5F7] px-3 py-1 text-xs text-[#6e6e73]">{total.currency}: {total.missingAmounts} missing amounts · {total.missingProbabilities} open probabilities missing</span>)}</div>
      {effectiveTarget !== null && data.filters.currency && <div className="rounded-lg bg-blue-50 p-4"><p className="text-sm font-medium">Target: {money(effectiveTarget)} {data.filters.currency}</p><p className="text-xs text-[#6e6e73] mt-1">Committed coverage: {effectiveTarget > 0 ? `${money(committed / effectiveTarget * 100)}%` : "No percentage for a zero target"} · Gap to target: {money(Math.max(0, effectiveTarget - committed))}</p></div>}
    </Card>
    {!selected && latest && <Card title="Change since the latest submission"><p className="text-xs text-[#86868b]">Compared with {new Date(latest.createdAt).toLocaleString()} for the same period, owner, and currency filters.</p><div className="overflow-x-auto"><table className="w-full text-sm text-right"><thead><tr className="border-b border-black/10 text-xs text-[#86868b]"><th className="py-2 text-left" scope="col">Currency</th><th scope="col">Won change</th><th scope="col">Committed change</th><th scope="col">Weighted change</th></tr></thead><tbody>{currencies.map(currency => { const live = snapshot.totals.find(t => t.currency === currency) || zero(currency); const previous = latest.snapshot.totals.find(t => t.currency === currency) || zero(currency); return <tr key={currency}><th scope="row" className="py-3 text-left font-medium">{currency}</th><td>{delta(live.won - previous.won)}</td><td>{delta(live.committed - previous.committed)}</td><td>{delta(live.weighted - previous.weighted)}</td></tr>; })}</tbody></table></div></Card>}
    <Card title={selected ? "Deals included in this submission" : "Deals included in this forecast"}><div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr className="border-b border-black/10 text-xs text-[#86868b]"><th className="py-3 pr-4" scope="col">Deal</th><th className="pr-4" scope="col">Category</th><th className="pr-4" scope="col">Amount</th><th className="pr-4" scope="col">Probability</th><th className="pr-4" scope="col">Close date</th><th scope="col">Activity flags</th></tr></thead><tbody>{snapshot.deals.map(deal => <tr key={deal.id} className="border-b border-black/[.06]"><td className="py-3 pr-4 min-w-40"><Link href={`/deals/${encodeURIComponent(deal.id)}`} className="font-medium text-[#007AFF]">{deal.name}</Link><p className="text-xs text-[#86868b] mt-1">{deal.owner || "Unassigned"} · {deal.stage || "No stage"}</p></td><td className="pr-4 whitespace-nowrap">{deal.closed ? "Won" : CATEGORY_LABELS[deal.review.category]}</td><td className="pr-4 whitespace-nowrap">{deal.amount === null ? "Unavailable" : money(Number(deal.amount))} {deal.currency || "Unspecified"}</td><td className="pr-4">{deal.closed ? "100%" : deal.review.probability === null ? "—" : `${deal.review.probability}%`}</td><td className="pr-4 whitespace-nowrap">{deal.closeDate?.slice(0, 10)}</td><td className="text-xs text-amber-800 min-w-40">{deal.risks.join(" · ") || "—"}</td></tr>)}</tbody></table></div>{!snapshot.deals.length && <p className="text-sm text-[#6e6e73]">No deals included. Connect a CRM or choose a period with close dates.</p>}</Card>
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]"><Card title="Submit a forecast"><form onSubmit={e => { e.preventDefault(); void submit(); }}><fieldset disabled={busy || pendingFilters || !!selected} className="space-y-3"><p className="text-xs text-[#6e6e73]">Saves the current CRM amounts and manager categories for {data.filters.period}. Each submission remains available for comparison.</p><label className="block text-sm space-y-1">Revenue target (optional)<input className={fieldClass} type="number" min={0} max={1e12} step="any" placeholder={data.filters.currency && data.filters.currency !== "Unspecified currency" ? `Target in ${data.filters.currency}` : "Select one known currency to set a target"} disabled={!data.filters.currency || data.filters.currency === "Unspecified currency"} value={target} onChange={e => { setTarget(e.target.value); requestId.current = null; }} /></label><ChipSelect label="Manager notes" options={NOTE_OPTIONS} selected={notesChoice.selected} other={notesChoice.other} onChange={selected => { setNotes(joinChoice(selected, notesChoice.other)); requestId.current = null; }} onOther={other => { setNotes(joinChoice(notesChoice.selected, other)); requestId.current = null; }} otherPlaceholder="Other note" /><button className={buttonClass}>{busy ? "Submitting…" : "Submit current forecast"}</button></fieldset></form>{pendingFilters && <p className="text-xs text-amber-800 mt-3">Apply your filter changes before submitting.</p>}{selected && <p className="text-xs text-[#86868b] mt-3">Return to the live forecast to submit a new snapshot.</p>}</Card>
      <LiveChartPanel title="Forecast by category" subtitle="The bars follow the live snapshot and the target you type, before you submit.">
        <BarChart bars={chartTotal ? [{ label: "Won", value: chartTotal.won }, { label: "Pipeline", value: chartTotal.pipeline }, { label: "Best case", value: chartTotal.bestCase }, { label: "Commit", value: chartTotal.commit }, { label: "Weighted", value: chartTotal.weighted }, { label: "Target", value: Number(target) || 0 }] : []} />
      </LiveChartPanel>
    </div>
    <Card title="Submission history">{data.history.map(saved => <button key={saved.id} type="button" onClick={() => setSelected(saved)} className={`w-full text-left rounded-lg border p-3 ${selected?.id === saved.id ? "border-blue-300 bg-blue-50" : "border-black/10 hover:bg-[#F5F5F7]"}`}><p className="text-sm font-medium">{new Date(saved.createdAt).toLocaleString()}</p><p className="text-xs text-[#86868b] mt-1">{saved.createdBy} · {saved.snapshot.deals.length} deals{saved.target !== null ? ` · Target ${money(Number(saved.target))} ${saved.currency}` : ""}</p>{saved.notes && <p className="text-sm text-[#6e6e73] mt-2 whitespace-pre-wrap">{saved.notes}</p>}</button>)}{!data.history.length && <p className="text-sm text-[#6e6e73]">No submissions for these filters. Submit a forecast to start tracking changes.</p>}<p className="text-xs text-[#86868b]">Showing up to 20 recent submissions for the selected filters. Saved rows retain deal metadata and amounts; transcript text is excluded.</p></Card>
  </div>;
}

"use client";
import { Card } from "./ui";
import { formatDuration } from "@/lib/utils";
import type { ProviderInsights } from "@/lib/revenue/types";

export default function CallProviderInsights({ insights, jump }: { insights: ProviderInsights; jump: (seconds: number) => void }) {
  return <Card title="Gong call insights">
    {insights.outcome && <p className="text-sm font-medium">Outcome: {insights.outcome}</p>}
    {insights.keyPoints.length > 0 && <ul className="list-disc space-y-1 pl-4 text-sm text-[#6e6e73]">{insights.keyPoints.map((text, i) => <li key={i}>{text}</li>)}</ul>}
    {insights.highlights.map((section, i) => <div key={i} className="space-y-2"><h4 className="text-sm font-medium">{section.title}</h4>{section.items.map((item, j) => <div key={j} className="rounded-lg bg-[#F5F5F7] p-3 text-sm"><p>{item.text}</p>{item.times.map((time, k) => <button key={k} className="mr-3 mt-1 text-xs text-[#007AFF]" onClick={() => jump(time)}>{formatDuration(time)}</button>)}</div>)}</div>)}
    {insights.outline.length > 0 && <details><summary className="cursor-pointer text-sm font-medium">Call outline</summary><div className="mt-3 space-y-3">{insights.outline.map((s, i) => <div key={i}><button className="text-sm text-[#007AFF]" onClick={() => jump(s.start)}>{formatDuration(s.start)} · {s.title}</button>{s.items.map((item, j) => <p key={j} className="text-xs leading-5 text-[#6e6e73]">{item}</p>)}</div>)}</div></details>}
    {insights.topics.length > 0 && <div className="flex flex-wrap gap-2">{insights.topics.map((t, i) => <span key={i} className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-800">{t.name} · {formatDuration(t.duration)}</span>)}</div>}
    {insights.trackers.map((t, i) => <div key={i}><p className="text-xs font-medium">{t.name}</p>{t.occurrences.map((o, j) => <button key={j} className="mr-3 text-xs text-[#007AFF]" onClick={() => jump(o.start)}>{formatDuration(o.start)} · {o.phrase}</button>)}</div>)}
    {(insights.metrics.length > 0 || insights.speakers.length > 0) && <details><summary className="cursor-pointer text-sm font-medium">Provider speaker metrics</summary><div className="mt-3 space-y-1 text-xs text-[#6e6e73]">{insights.metrics.map((m, i) => <p key={i}>{m.name}: {m.value}</p>)}{insights.speakers.map((s, i) => <p key={i}>{s.name}: {formatDuration(s.seconds)} speaking time</p>)}</div></details>}
  </Card>;
}

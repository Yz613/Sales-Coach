"use client";

import { useState, type ReactNode } from "react";
import { formatRate } from "@/lib/dialFunnel";

export interface ChartBar {
  label: string;
  value: number;
  hint?: string;
  color?: string;
}

const COLORS = ["#007AFF", "#34C759", "#FF9500", "#AF52DE", "#FF3B30", "#5AC8FA", "#FFCC00"];

export function FunnelChart({
  steps,
}: {
  steps: { label: string; count: number; rateFromStart?: number; rateFromPrevious?: number }[];
}) {
  const max = Math.max(...steps.map((step) => step.count), 1);
  return (
    <div className="space-y-2" aria-label="Call outcome funnel">
      {steps.map((step, index) => (
        <div key={step.label}>
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="font-medium text-[#1d1d1f]">{index + 1}. {step.label}</span>
            <span className="font-mono text-[#3a3a3c]">{step.count.toLocaleString()}</span>
          </div>
          <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-black/[0.06]">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max(step.count ? 4 : 0, (step.count / max) * 100)}%`, background: COLORS[index % COLORS.length] }}
            />
          </div>
          {index > 0 && (
            <p className="mt-0.5 text-[10px] text-[#86868b]">
              {formatRate(step.rateFromPrevious || 0)} of previous · {formatRate(step.rateFromStart || 0)} of dials
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export function BarChart({ bars, unit = "" }: { bars: ChartBar[]; unit?: string }) {
  const max = Math.max(...bars.map((bar) => bar.value), 1);
  return (
    <div className="space-y-2.5" role="img" aria-label="Bar chart">
      {bars.map((bar, index) => (
        <div key={bar.label}>
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="truncate text-[#1d1d1f]">{bar.label}</span>
            <span className="shrink-0 font-mono text-[#3a3a3c]">{bar.value.toLocaleString()}{unit}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/[0.06]">
            <div className="h-full rounded-full" style={{ width: `${(bar.value / max) * 100}%`, background: bar.color || COLORS[index % COLORS.length] }} />
          </div>
          {bar.hint && <p className="mt-0.5 text-[10px] text-[#86868b]">{bar.hint}</p>}
        </div>
      ))}
      {bars.length === 0 && <p className="text-xs text-[#86868b]">Nothing to chart yet.</p>}
    </div>
  );
}

export function RateTrio({
  connectRate,
  closeRate,
  closePerConnect,
  dials,
  connects,
  closes,
}: {
  connectRate: number;
  closeRate: number;
  closePerConnect: number;
  dials: number;
  connects: number;
  closes: number;
}) {
  const items = [
    { label: "Connect rate", detail: "Connects / dials", value: connectRate, sub: `${connects.toLocaleString()} / ${dials.toLocaleString()}` },
    { label: "Close rate", detail: "Closes / dials", value: closeRate, sub: `${closes.toLocaleString()} / ${dials.toLocaleString()}` },
    { label: "Close per connect", detail: "Closes / connects", value: closePerConnect, sub: `${closes.toLocaleString()} / ${connects.toLocaleString()}` },
  ];
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border border-black/[0.08] bg-white px-3 py-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[#86868b]">{item.label}</div>
          <div className="mt-1 font-mono text-xl font-bold text-[#1d1d1f]">{formatRate(item.value)}</div>
          <div className="text-[10px] text-[#6e6e73]">{item.detail}</div>
          <div className="font-mono text-[10px] text-[#86868b]">{item.sub}</div>
        </div>
      ))}
    </div>
  );
}

/** Right rail on desktop. On a narrow screen it sits under the form and can collapse. */
export function LiveChartPanel({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <aside className="lg:sticky lg:top-4">
      <section className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
        <button
          type="button"
          className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left lg:cursor-default"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          <span>
            <span className="block text-sm font-semibold text-[#1d1d1f]">{title}</span>
            {subtitle && <span className="mt-0.5 block text-[11px] text-[#6e6e73]">{subtitle}</span>}
          </span>
          <span className="rounded-full bg-[#F5F5F7] px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#6e6e73] lg:hidden">
            {open ? "Hide" : "Show"}
          </span>
        </button>
        <div className={`${open ? "block" : "hidden"} space-y-4 border-t border-black/[0.06] px-4 py-4 lg:block`}>
          {children}
        </div>
      </section>
    </aside>
  );
}

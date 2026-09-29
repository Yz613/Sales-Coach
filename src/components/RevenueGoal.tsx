"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Target } from "lucide-react";
import { formatGroupedNumber, parseGroupedNumber, planRevenueGoal } from "@/lib/revenueGoal";

const STORAGE_KEY = "sc-revenue-goal";
const OPEN_KEY = "sc-revenue-goal-open";

interface SavedGoal {
  revenue: string;
  averageRevenue: string;
  sellingDays: string;
}

function readSaved(): SavedGoal | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedGoal>;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      revenue: formatGroupedNumber(String(parsed.revenue ?? "")),
      averageRevenue: formatGroupedNumber(String(parsed.averageRevenue ?? "")),
      sellingDays: formatGroupedNumber(String(parsed.sellingDays ?? "5")).replace(/\..*$/, "") || "5",
    };
  } catch {
    return null;
  }
}

function money(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function count(value: number): string {
  return value.toLocaleString("en-US");
}

function formatRate(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return rounded.toLocaleString("en-US", {
    maximumFractionDigits: Number.isInteger(rounded) ? 0 : 1,
  });
}

export default function RevenueGoal({
  teamCloseRate,
  loggedCalls,
  repCount,
}: {
  teamCloseRate: number;
  loggedCalls: number;
  repCount: number;
}) {
  const [revenue, setRevenue] = useState("");
  const [averageRevenue, setAverageRevenue] = useState("");
  const [sellingDays, setSellingDays] = useState("5");
  const [open, setOpen] = useState(true);
  const [ready, setReady] = useState(false);
  const closeRate = loggedCalls > 0 ? teamCloseRate : 0;

  useEffect(() => {
    const saved = readSaved();
    if (saved) {
      setRevenue(saved.revenue);
      setAverageRevenue(saved.averageRevenue);
      setSellingDays(saved.sellingDays || "5");
    }
    if (window.localStorage.getItem(OPEN_KEY) === "0") setOpen(false);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const payload: SavedGoal = { revenue, averageRevenue, sellingDays };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    window.localStorage.setItem(OPEN_KEY, open ? "1" : "0");
  }, [ready, revenue, averageRevenue, sellingDays, open]);

  const plan = planRevenueGoal({
    revenue: parseGroupedNumber(revenue),
    averageRevenue: parseGroupedNumber(averageRevenue),
    closeRatePercent: closeRate,
    sellingDaysPerWeek: parseGroupedNumber(sellingDays) || 5,
    repCount,
  });

  const rateLabel = loggedCalls > 0 ? `${formatRate(teamCloseRate)}%` : "—";

  return (
    <div className={`rounded-2xl glass-card ${open ? "p-6 sm:p-7 space-y-5" : "p-4 sm:p-5"}`}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div>
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <Target className="h-4 w-4" /> Quarter goal
          </div>
          <h2 className="text-lg font-bold text-white mt-1 tracking-tight">Calls required to hit the number</h2>
          {open ? (
            <p className="text-xs text-slate-400 mt-1 max-w-3xl">
              Revenue divided by average customer, then divided by the close rate from calls logged in this tool.
              {loggedCalls > 0
                ? ` Logged calls are booking a meeting ${formatRate(teamCloseRate)}% of the time.`
                : " No logged calls yet, so the close rate stays blank until this tool has one."}
            </p>
          ) : (
            <p className="text-sm text-slate-300 mt-1">
              {plan
                ? `${count(plan.callsQuarter)} calls this quarter · ${rateLabel} close rate`
                : "Open to set the revenue number."}
            </p>
          )}
        </div>
        <ChevronDown className={`mt-1 h-5 w-5 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="space-y-1.5">
              <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-500">Revenue to add</span>
              <input
                inputMode="decimal"
                value={revenue}
                onChange={(e) => setRevenue(formatGroupedNumber(e.target.value))}
                placeholder="500,000"
                className="w-full rounded-xl glass-inset border border-white/[0.08] px-3 py-2.5 text-sm text-white font-mono focus:border-blue-500/50 focus:outline-none"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-500">Avg revenue / customer</span>
              <input
                inputMode="decimal"
                value={averageRevenue}
                onChange={(e) => setAverageRevenue(formatGroupedNumber(e.target.value))}
                placeholder="10,000"
                className="w-full rounded-xl glass-inset border border-white/[0.08] px-3 py-2.5 text-sm text-white font-mono focus:border-blue-500/50 focus:outline-none"
              />
            </label>
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-500">Close rate %</span>
              <div
                aria-readonly="true"
                className="w-full rounded-xl glass-inset border border-white/[0.08] px-3 py-2.5 text-sm text-slate-200 font-mono"
              >
                {rateLabel}
              </div>
              <p className="text-[10px] text-slate-500">From logged calls. Not editable.</p>
            </div>
            <label className="space-y-1.5">
              <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-500">Selling days / week</span>
              <input
                inputMode="numeric"
                value={sellingDays}
                onChange={(e) => setSellingDays(formatGroupedNumber(e.target.value).replace(/\..*$/, ""))}
                placeholder="5"
                className="w-full rounded-xl glass-inset border border-white/[0.08] px-3 py-2.5 text-sm text-white font-mono focus:border-blue-500/50 focus:outline-none"
              />
            </label>
          </div>

          {plan ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-300">
                {money(parseGroupedNumber(revenue))} / {money(parseGroupedNumber(averageRevenue))} = {count(plan.customers)} customers.
                At {formatRate(closeRate)}% that is {count(plan.callsQuarter)} calls this quarter.
              </p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Result label="Per quarter" value={count(plan.callsQuarter)} hint="calls" />
                <Result label="Per week" value={count(plan.callsWeek)} hint="13 weeks" />
                <Result label="Per day" value={count(plan.callsDay)} hint={`${sellingDays || 5} selling days`} />
                <Result label="Per rep / day" value={count(plan.callsPerRepDay)} hint={repCount === 1 ? "1 rep" : `${count(repCount)} reps`} />
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              {loggedCalls > 0 && closeRate <= 0
                ? "Logged calls have a 0% close rate, so the call count cannot be calculated yet."
                : "Enter revenue and average revenue above zero. Close rate comes from logged calls."}
            </p>
          )}
        </>
      ) : null}
    </div>
  );
}

function Result({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl glass-inset border border-white/[0.08] p-4">
      <div className="text-[10px] uppercase font-semibold tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-white font-mono">{value}</div>
      <div className="text-xs text-slate-400">{hint}</div>
    </div>
  );
}

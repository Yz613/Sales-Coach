"use client";

import { useEffect, useState } from "react";
import { Target } from "lucide-react";
import { planRevenueGoal } from "@/lib/revenueGoal";

const STORAGE_KEY = "sc-revenue-goal";

interface SavedGoal {
  revenue: string;
  averageRevenue: string;
  closeRate: string;
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
      revenue: String(parsed.revenue ?? ""),
      averageRevenue: String(parsed.averageRevenue ?? ""),
      closeRate: String(parsed.closeRate ?? ""),
      sellingDays: String(parsed.sellingDays ?? "5"),
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
  const [closeRate, setCloseRate] = useState(teamCloseRate > 0 ? String(teamCloseRate) : "");
  const [sellingDays, setSellingDays] = useState("5");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = readSaved();
    if (saved) {
      setRevenue(saved.revenue);
      setAverageRevenue(saved.averageRevenue);
      setCloseRate(saved.closeRate || (teamCloseRate > 0 ? String(teamCloseRate) : ""));
      setSellingDays(saved.sellingDays || "5");
    }
    setReady(true);
  }, [teamCloseRate]);

  useEffect(() => {
    if (!ready) return;
    const payload: SavedGoal = { revenue, averageRevenue, closeRate, sellingDays };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [ready, revenue, averageRevenue, closeRate, sellingDays]);

  const plan = planRevenueGoal({
    revenue: Number(revenue),
    averageRevenue: Number(averageRevenue),
    closeRatePercent: Number(closeRate),
    sellingDaysPerWeek: Number(sellingDays) || 5,
    repCount,
  });

  return (
    <div className="rounded-2xl glass-card p-6 sm:p-7 space-y-5">
      <div>
        <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
          <Target className="h-4 w-4" /> Quarter goal
        </div>
        <h2 className="text-lg font-bold text-white mt-1 tracking-tight">Calls required to hit the number</h2>
        <p className="text-xs text-slate-400 mt-1 max-w-3xl">
          Revenue divided by average customer, then divided by how often a call becomes a customer.
          {loggedCalls > 0
            ? ` Logged calls are booking a meeting ${teamCloseRate}% of the time. Use that, or type the close rate you actually sell at.`
            : " No logged calls yet, so type the close rate yourself."}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <label className="space-y-1.5">
          <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-500">Revenue to add</span>
          <input
            inputMode="decimal"
            value={revenue}
            onChange={(e) => setRevenue(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder="500000"
            className="w-full rounded-xl glass-inset border border-white/[0.08] px-3 py-2.5 text-sm text-white font-mono focus:border-blue-500/50 focus:outline-none"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-500">Avg revenue / customer</span>
          <input
            inputMode="decimal"
            value={averageRevenue}
            onChange={(e) => setAverageRevenue(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder="10000"
            className="w-full rounded-xl glass-inset border border-white/[0.08] px-3 py-2.5 text-sm text-white font-mono focus:border-blue-500/50 focus:outline-none"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-500">Close rate %</span>
          <input
            inputMode="decimal"
            value={closeRate}
            onChange={(e) => setCloseRate(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder="3"
            className="w-full rounded-xl glass-inset border border-white/[0.08] px-3 py-2.5 text-sm text-white font-mono focus:border-blue-500/50 focus:outline-none"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-500">Selling days / week</span>
          <input
            inputMode="numeric"
            value={sellingDays}
            onChange={(e) => setSellingDays(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="5"
            className="w-full rounded-xl glass-inset border border-white/[0.08] px-3 py-2.5 text-sm text-white font-mono focus:border-blue-500/50 focus:outline-none"
          />
        </label>
      </div>

      {teamCloseRate > 0 && closeRate !== String(teamCloseRate) ? (
        <button
          type="button"
          onClick={() => setCloseRate(String(teamCloseRate))}
          className="text-xs font-semibold text-blue-400 hover:text-blue-300"
        >
          Use the team rate ({teamCloseRate}%)
        </button>
      ) : null}

      {plan ? (
        <div className="space-y-3">
          <p className="text-xs text-slate-300">
            {money(Number(revenue))} / {money(Number(averageRevenue))} = {count(plan.customers)} customers.
            At {closeRate}% that is {count(plan.callsQuarter)} calls this quarter.
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Result label="Per quarter" value={count(plan.callsQuarter)} hint="calls" />
            <Result label="Per week" value={count(plan.callsWeek)} hint="13 weeks" />
            <Result label="Per day" value={count(plan.callsDay)} hint={`${sellingDays || 5} selling days`} />
            <Result label="Per rep / day" value={count(plan.callsPerRepDay)} hint={repCount === 1 ? "1 rep" : `${repCount} reps`} />
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-500">Enter revenue, average revenue, and a close rate above zero.</p>
      )}
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

"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Plus, Target, Users } from "lucide-react";
import { formatGroupedNumber, parseGroupedNumber, GOAL_PERIODS, type GoalPeriod } from "@/lib/revenueGoal";
import { createGoalTeam, goalTeamMetrics, validateGoalTeams, type GoalRep, type GoalTeam } from "@/lib/goalTeams";
import { BarChart, RateTrio } from "@/components/charts/MetricCharts";
import { useAppAuth } from "@/lib/auth-context";
import { apiPath } from "@/lib/utils";

const inputClass = "w-full rounded-xl glass-inset border border-black/[0.08] px-3 py-2.5 text-sm text-[#1d1d1f] focus:border-blue-500/50 focus:outline-none";
const count = (value: number) => value.toLocaleString("en-US");
const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const rate = (value: number) => `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;

export default function RevenueGoal({ initialTeams, reps }: { initialTeams: GoalTeam[]; reps: GoalRep[] }) {
  const { isAdmin } = useAppAuth();
  const [teams, setTeams] = useState(initialTeams);
  const [savedTeams, setSavedTeams] = useState(JSON.stringify(initialTeams));
  const [selectedId, setSelectedId] = useState(initialTeams[0].id);
  const [open, setOpen] = useState(true);
  const [manage, setManage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const team = teams.find((item) => item.id === selectedId) ?? teams[0];
  const metrics = goalTeamMetrics(team, reps);
  const { plan, repCount, members, closeRate, connectRate, closePerConnect, loggedCalls, connects, closes, repPlans } = metrics;
  const dirty = JSON.stringify(teams) !== savedTeams;
  const periodLabel = GOAL_PERIODS[team.period].label.toLowerCase();
  const allRepTargetsKnown = repPlans.length > 0 && repPlans.every((item) => item.plan);
  const assignedCalls = repPlans.reduce((sum, item) => sum + (item.plan?.callsPeriod ?? 0), 0);

  function updateTeam(id: string, patch: Partial<GoalTeam>) {
    setTeams((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
    setMessage("");
    setError("");
  }

  function addTeam() {
    let n = teams.length + 1;
    while (teams.some((item) => item.name.toLowerCase() === `team ${n}`)) n++;
    const next = createGoalTeam(crypto.randomUUID(), `Team ${n}`);
    setTeams((current) => [...current, next]);
    setSelectedId(next.id);
    setManage(true);
    setMessage("");
    setError("");
  }

  function assignRep(repId: string, teamId: string) {
    setTeams((current) => current.map((item) => ({
      ...item,
      repIds: item.id === teamId ? [...item.repIds.filter((id) => id !== repId), repId] : item.repIds.filter((id) => id !== repId),
    })));
    setMessage("");
    setError("");
  }

  async function save() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const next = validateGoalTeams(teams, reps.map((rep) => rep.id));
      const response = await fetch(apiPath("/api/admin/goal-teams"), {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teams: next }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save team goals.");
      setTeams(data.teams);
      setSavedTeams(JSON.stringify(data.teams));
      setMessage("Team goals and assignments saved for this workspace.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save team goals.");
    } finally {
      setSaving(false);
    }
  }

  if (!isAdmin) return null;

  return (
    <section aria-label="Team revenue goals" className={`rounded-2xl glass-card ${open ? "p-6 sm:p-7 space-y-5" : "p-4 sm:p-5"}`}>
      <button type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open} className="flex w-full items-start justify-between gap-3 text-left">
        <div>
          <div className="flex items-center gap-2 text-[#248A3D] text-xs font-bold uppercase tracking-wider"><Target className="h-4 w-4" /> Team goals · Admins only</div>
          <h2 className="text-lg font-bold text-[#1d1d1f] mt-1 tracking-tight">Calls required to hit the number</h2>
          <p className="text-xs text-[#6e6e73] mt-1 max-w-3xl">
            {open ? "Plan by quarter, month, or week. Each team uses its own roster and logged close rates." : `${team.name} · ${GOAL_PERIODS[team.period].label} goal${plan ? ` · ${count(plan.callsPeriod)} calls at the team rate` : ""}${dirty ? " · Unsaved changes" : ""}`}
          </p>
        </div>
        <ChevronDown className={`mt-1 h-5 w-5 shrink-0 text-[#6e6e73] transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && <>
        <fieldset disabled={saving} className="space-y-5 disabled:opacity-60">
          <div className="flex flex-wrap items-center gap-2">
            <div role="tablist" aria-label="Goal teams" className="flex flex-wrap gap-2">
              {teams.map((item) => <button key={item.id} id={`goal-tab-${item.id}`} role="tab" aria-selected={team.id === item.id} aria-controls="goal-team-panel" onClick={() => { setSelectedId(item.id); setError(""); }} type="button" className={`rounded-xl px-4 py-2 text-sm font-semibold border transition ${team.id === item.id ? "bg-blue-500/10 border-blue-500/30 text-[#007AFF]" : "border-black/[0.08] text-[#3a3a3c] hover:bg-black/[0.03]"}`}>
                {item.name || "Unnamed team"} <span className="ml-1 text-xs font-normal">({item.repIds.length})</span>
              </button>)}
            </div>
            <button type="button" onClick={addTeam} disabled={teams.length >= 100} className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold text-[#007AFF] hover:bg-blue-500/10"><Plus className="h-4 w-4" /> Add team</button>
            <button type="button" onClick={() => setManage((value) => !value)} aria-expanded={manage} className="ml-auto inline-flex items-center gap-1 rounded-xl border border-black/[0.08] px-3 py-2 text-xs font-semibold text-[#3a3a3c]"><Users className="h-4 w-4" /> {manage ? "Hide team management" : "Manage teams & reps"}</button>
          </div>

          {manage && <div className="rounded-xl border border-black/[0.08] p-4 space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex-1 min-w-48 space-y-1.5"><Label>Team name</Label><input value={team.name} maxLength={80} onChange={(event) => updateTeam(team.id, { name: event.target.value })} className={inputClass} /></label>
              <button type="button" disabled={teams.length === 1} onClick={() => {
                const next = teams.filter((item) => item.id !== team.id);
                setTeams(next); setSelectedId(next[0].id); setMessage(""); setError("");
              }} className="rounded-xl border border-rose-500/20 px-3 py-2.5 text-xs font-semibold text-[#FF3B30] disabled:opacity-40">Remove team</button>
            </div>
            <p className="text-xs text-[#6e6e73]">Assign each rep to one team. Moving a rep updates both teams immediately. Removing a team leaves its reps unassigned.</p>
            {reps.length ? <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {reps.map((rep) => <label key={rep.id} className="flex items-center gap-3 rounded-xl glass-inset p-3">
                <span className="min-w-0 flex-1 text-sm text-[#1d1d1f] font-medium">{rep.name}</span>
                <select aria-label={`Team for ${rep.name}`} value={teams.find((item) => item.repIds.includes(rep.id))?.id ?? ""} onChange={(event) => assignRep(rep.id, event.target.value)} className={`${inputClass} max-w-[55%]`}>
                  <option value="">Unassigned</option>
                  {teams.map((item) => <option key={item.id} value={item.id}>{item.name || "Unnamed team"}</option>)}
                </select>
              </label>)}
            </div> : <p className="text-xs text-[#86868b]">No reps yet. Reps will appear here after calls are uploaded.</p>}
            {reps.some((rep) => !teams.some((item) => item.repIds.includes(rep.id))) && <p className="text-xs text-[#C45500]">Unassigned reps are excluded from all team rates and targets.</p>}
          </div>}

          <div id="goal-team-panel" role="tabpanel" aria-labelledby={`goal-tab-${team.id}`} className="space-y-5">
            <div key={team.id} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <label className="space-y-1.5"><Label>Goal period</Label>
                <select value={team.period} onChange={(event) => updateTeam(team.id, { period: event.target.value as GoalPeriod })} className={inputClass}>
                  {Object.entries(GOAL_PERIODS).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
                </select>
              </label>
              <NumberField label={`Revenue to add this ${periodLabel}`} value={team.revenue} onChange={(value) => updateTeam(team.id, { revenue: value })} placeholder="500,000" />
              <NumberField label="Avg revenue / customer" value={team.averageRevenue} onChange={(value) => updateTeam(team.id, { averageRevenue: value })} placeholder="10,000" />
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                <Label>Rates from every dial</Label>
                <RateTrio connectRate={connectRate} closeRate={closeRate} closePerConnect={closePerConnect} dials={loggedCalls} connects={connects} closes={closes} />
                <p className="text-[10px] text-[#86868b]">{count(loggedCalls)} dials · Close rate is closed won / every dial. Close per connect is closes / connects.</p>
              </div>
              <NumberField label="Selling days / week" value={team.sellingDaysPerWeek} onChange={(value) => updateTeam(team.id, { sellingDaysPerWeek: value })} integer placeholder="5" />
              <div className="space-y-1.5">
                <NumberField label="Number of reps" value={repCount} onChange={(value) => updateTeam(team.id, { repCount: value })} integer placeholder="1" />
                <div className="flex flex-wrap items-center gap-2 text-[10px] text-[#86868b]"><span>{team.repCount === null ? "Follows assigned roster" : "Manual planning count"} · {members.length} assigned</span>
                  {team.repCount !== null && <button type="button" onClick={() => updateTeam(team.id, { repCount: null })} className="text-[#007AFF] underline">Use assigned count</button>}
                </div>
              </div>
            </div>

            {plan ? <div className="space-y-3">
              <p className="text-xs text-[#3a3a3c]">{money(team.revenue)} / {money(team.averageRevenue)} = {count(plan.customers)} customers this {periodLabel}. At the team’s {rate(closeRate)} close rate, estimate {count(plan.callsPeriod)} calls.</p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Result label={`Per ${periodLabel}`} value={count(plan.callsPeriod)} hint="calls · team-rate estimate" />
                <Result label="Per week" value={count(plan.callsWeek)} hint={team.period === "month" ? "4⅓ weeks per month" : `${plan.weeks} ${plan.weeks === 1 ? "week" : "weeks"}`} />
                <Result label="Per selling day" value={count(plan.callsDay)} hint={`${team.sellingDaysPerWeek} selling days / week`} />
                <Result label="Avg per rep / day" value={count(plan.callsPerRepDay)} hint={`${count(repCount)} planned ${repCount === 1 ? "rep" : "reps"}`} />
              </div>
              <BarChart bars={[
                { label: `Calls this ${periodLabel}`, value: plan.callsPeriod },
                { label: "Per week", value: plan.callsWeek },
                { label: "Per selling day", value: plan.callsDay },
                { label: "Per rep / day", value: plan.callsPerRepDay },
              ]} />
            </div> : <p className="text-xs text-[#86868b]">{members.length === 0 ? "Assign reps to this team to calculate its close rate." : loggedCalls === 0 ? "This team has no logged calls yet. Its close rate and call targets will appear after dials are logged." : closeRate === 0 ? "This team has a 0% close rate. Call targets need a closed-won dial before they can be calculated." : "Enter revenue and average customer revenue above zero, 1–7 selling days, and a positive whole rep count."}</p>}

            <div className="space-y-3">
              <h3 className="text-sm font-bold text-[#1d1d1f]">{team.name || "Team"} · Individual rep targets</h3>
              <p className="text-xs text-[#6e6e73]">Team revenue is split equally across {count(repCount)} planned {repCount === 1 ? "rep" : "reps"}. Each assigned rep’s target uses their own close rate: closed won divided by every dial. All calls round up.</p>
              {repCount !== members.length && <p className="text-xs text-[#C45500]">Planning for {count(repCount)} reps with {members.length} assigned. Match the roster and planning count for a complete team breakdown.</p>}
              {members.length > 0 && <div className="overflow-x-auto rounded-xl border border-black/[0.08]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-black/[0.03] text-[#6e6e73]"><tr>{["Rep", "Dials", "Close rate", `${GOAL_PERIODS[team.period].label} revenue goal`, `Calls this ${periodLabel}`, "Weekly pace", "Daily pace"].map((label) => <th key={label} scope="col" className="px-4 py-3 whitespace-nowrap font-semibold">{label}</th>)}</tr></thead>
                  <tbody>{repPlans.map((item) => <tr key={item.rep.id} className="border-t border-black/[0.06] text-[#3a3a3c]">
                    <th scope="row" className="px-4 py-3 font-semibold whitespace-nowrap">{item.rep.name}{!item.plan && <div className="font-normal text-[10px] text-[#86868b]">{item.rep.loggedCalls === 0 ? "No logged dials" : item.closeRate === 0 ? "No closed-won dials yet" : "Set valid goal inputs"}</div>}</th>
                    <td className="px-4 py-3 font-mono">{count(item.rep.loggedCalls)}</td>
                    <td className="px-4 py-3 font-mono" aria-readonly="true">{item.rep.loggedCalls ? rate(item.closeRate) : "—"}</td>
                    <td className="px-4 py-3 font-mono">{repCount > 0 ? money(item.revenue) : "—"}</td>
                    <td className="px-4 py-3 font-mono font-semibold">{item.plan ? count(item.plan.callsPeriod) : "—"}</td>
                    <td className="px-4 py-3 font-mono">{item.plan ? count(item.plan.callsWeek) : "—"}</td>
                    <td className="px-4 py-3 font-mono">{item.plan ? count(item.plan.callsDay) : "—"}</td>
                  </tr>)}</tbody>
                </table>
              </div>}
              {allRepTargetsKnown && repCount === members.length && <p className="text-xs font-semibold text-[#3a3a3c]">Total from individual rep targets: {count(assignedCalls)} calls this {periodLabel}. This accounts for each rep’s rate and can differ from the team-rate estimate.</p>}
            </div>
          </div>
        </fieldset>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/[0.08] pt-4">
          <p className="text-xs text-[#6e6e73]">{dirty ? "Unsaved changes" : "Goals and rosters are shared with admins in this workspace."}</p>
          <button type="button" onClick={save} disabled={saving || !dirty} className="rounded-xl bg-[#007AFF] hover:bg-[#0071E3] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-40">{saving ? "Saving…" : "Save team goals"}</button>
        </div>
        {error && <p role="alert" className="text-xs text-[#FF3B30]">{error}</p>}
        {message && <p role="status" className="text-xs text-[#248A3D]">{message}</p>}
      </>}
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="block text-[10px] uppercase font-semibold tracking-wider text-[#86868b]">{children}</span>;
}

function NumberField({ label, value, onChange, integer = false, placeholder }: { label: string; value: number; onChange: (value: number) => void; integer?: boolean; placeholder: string }) {
  const [draft, setDraft] = useState(value ? formatGroupedNumber(String(value)) : "");
  useEffect(() => {
    if (parseGroupedNumber(draft) !== value) setDraft(value ? formatGroupedNumber(String(value)) : "");
  }, [value, draft]);
  return <label className="block space-y-1.5"><Label>{label}</Label><input inputMode={integer ? "numeric" : "decimal"} value={draft} placeholder={placeholder} onChange={(event) => {
    const formatted = formatGroupedNumber(event.target.value);
    const next = integer ? formatted.replace(/\..*$/, "") : formatted;
    setDraft(next); onChange(parseGroupedNumber(next));
  }} className={`${inputClass} font-mono`} /></label>;
}

function Result({ label, value, hint }: { label: string; value: string; hint: string }) {
  return <div className="rounded-xl glass-inset border border-black/[0.08] p-4"><Label>{label}</Label><div className="mt-1 text-2xl font-bold text-[#1d1d1f] font-mono">{value}</div><div className="text-xs text-[#6e6e73]">{hint}</div></div>;
}

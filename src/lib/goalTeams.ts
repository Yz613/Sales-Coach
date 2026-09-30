import { isMeetingBooked } from "./coreOutcome";
import { planRevenueGoal, type GoalPeriod } from "./revenueGoal";

export const GOAL_TEAMS_SETTING_KEY = "revenue_goal_teams";

export interface GoalTeam {
  id: string;
  name: string;
  repIds: string[];
  period: GoalPeriod;
  revenue: number;
  averageRevenue: number;
  sellingDaysPerWeek: number;
  /** null follows the assigned roster; a number is a manual planning override. */
  repCount: number | null;
}

export interface GoalRep {
  id: string;
  name: string;
  loggedCalls: number;
  bookedCalls: number;
}

export function createGoalTeam(id: string, name: string, repIds: string[] = []): GoalTeam {
  return { id, name, repIds, period: "quarter", revenue: 0, averageRevenue: 0, sellingDaysPerWeek: 5, repCount: null };
}

/** Rates use the same logged-call outcomes as the dashboard, without rounding before planning. */
export function buildGoalReps(
  reps: { id: string; name: string }[],
  calls: { repId: string; coreOutcome: string }[],
): GoalRep[] {
  const totals = new Map<string, { loggedCalls: number; bookedCalls: number }>();
  for (const call of calls) {
    const total = totals.get(call.repId) ?? { loggedCalls: 0, bookedCalls: 0 };
    total.loggedCalls++;
    if (isMeetingBooked(call.coreOutcome)) total.bookedCalls++;
    totals.set(call.repId, total);
  }
  return reps.map((rep) => ({ id: rep.id, name: rep.name, ...(totals.get(rep.id) ?? { loggedCalls: 0, bookedCalls: 0 }) }));
}

export function goalRepCloseRate(rep: Pick<GoalRep, "loggedCalls" | "bookedCalls">): number {
  return rep.loggedCalls > 0 ? (rep.bookedCalls / rep.loggedCalls) * 100 : 0;
}

export function goalTeamMetrics(team: GoalTeam, reps: GoalRep[]) {
  const members = reps.filter((rep) => team.repIds.includes(rep.id));
  const loggedCalls = members.reduce((sum, rep) => sum + rep.loggedCalls, 0);
  const bookedCalls = members.reduce((sum, rep) => sum + rep.bookedCalls, 0);
  const closeRate = goalRepCloseRate({ loggedCalls, bookedCalls });
  const repCount = team.repCount ?? members.length;
  const plan = repCount > 0 ? planRevenueGoal({ ...team, closeRatePercent: closeRate, repCount }) : null;
  // Equal revenue shares make the effect of each rep's own close rate explicit.
  const repRevenue = repCount > 0 ? team.revenue / repCount : 0;
  const repPlans = members.map((rep) => ({
    rep,
    closeRate: goalRepCloseRate(rep),
    revenue: repRevenue,
    plan: planRevenueGoal({ ...team, revenue: repRevenue, closeRatePercent: goalRepCloseRate(rep), repCount: 1 }),
  }));
  return { members, loggedCalls, bookedCalls, closeRate, repCount, plan, repPlans };
}

/** Never accept client-supplied close rates or rep ids outside the current workspace. */
export function validateGoalTeams(input: unknown, validRepIds: string[]): GoalTeam[] {
  if (!Array.isArray(input) || input.length === 0 || input.length > 100) {
    throw new Error("Add between 1 and 100 teams.");
  }
  const allowedReps = new Set(validRepIds);
  const assigned = new Set<string>();
  const ids = new Set<string>();
  const names = new Set<string>();
  return input.map((value: unknown) => {
    if (!value || typeof value !== "object") throw new Error("Invalid team.");
    const team = value as Record<string, unknown>;
    if (typeof team.id !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(team.id) || ids.has(team.id)) {
      throw new Error("Each team needs a unique id.");
    }
    ids.add(team.id);
    const name = typeof team.name === "string" ? team.name.trim() : "";
    if (!name || name.length > 80 || names.has(name.toLowerCase())) {
      throw new Error("Give each team a unique name of 1–80 characters.");
    }
    names.add(name.toLowerCase());
    if (!Array.isArray(team.repIds)) throw new Error("Invalid team roster.");
    const repIds = team.repIds.map((id: unknown) => {
      if (typeof id !== "string" || !allowedReps.has(id)) throw new Error("Choose reps from this workspace.");
      if (assigned.has(id)) throw new Error("A rep can belong to only one goal team.");
      assigned.add(id);
      return id;
    });
    if (team.period !== "quarter" && team.period !== "month" && team.period !== "week") {
      throw new Error("Choose quarter, month, or week.");
    }
    const numeric = (key: string, min: number, max: number, integer = false): number => {
      const n = team[key];
      if (typeof n !== "number" || !Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) {
        throw new Error(`Invalid ${key === "sellingDaysPerWeek" ? "selling days (1–7)" : key === "repCount" ? "rep count (1–10,000)" : key}.`);
      }
      return n;
    };
    return {
      id: team.id, name, repIds, period: team.period,
      revenue: numeric("revenue", 0, 1e12),
      averageRevenue: numeric("averageRevenue", 0, 1e12),
      sellingDaysPerWeek: numeric("sellingDaysPerWeek", 1, 7, true),
      repCount: team.repCount === null ? null : numeric("repCount", 1, 10_000, true),
    };
  });
}

export function readGoalTeams(raw: string | null, reps: { id: string }[]): GoalTeam[] {
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      // Deleted reps must not prevent the remaining saved teams from loading.
      if (Array.isArray(parsed)) {
        const validIds = new Set(reps.map((rep) => rep.id));
        const cleaned = parsed.map((team) => ({ ...team, repIds: Array.isArray(team?.repIds) ? team.repIds.filter((id: string) => validIds.has(id)) : [] }));
        return validateGoalTeams(cleaned, [...validIds]);
      }
    } catch {
      // A missing or invalid legacy setting starts with the current roster.
    }
  }
  return [createGoalTeam("core", "Core team", reps.map((rep) => rep.id))];
}

export const WEEKS_PER_QUARTER = 13;
export type GoalPeriod = "quarter" | "month" | "week";
export const GOAL_PERIODS: Record<GoalPeriod, { label: string; weeks: number }> = {
  quarter: { label: "Quarter", weeks: WEEKS_PER_QUARTER },
  month: { label: "Month", weeks: WEEKS_PER_QUARTER / 3 },
  week: { label: "Week", weeks: 1 },
};

/** Group a typed number with commas, keeping at most one decimal and two fraction digits. */
export function formatGroupedNumber(input: string): string {
  const cleaned = input.replace(/,/g, "").replace(/[^0-9.]/g, "");
  if (!cleaned) return "";
  const dot = cleaned.indexOf(".");
  const wholeRaw = dot === -1 ? cleaned : cleaned.slice(0, dot);
  const fraction = dot === -1 ? null : cleaned.slice(dot + 1).replace(/\./g, "").slice(0, 2);
  const wholeDigits = wholeRaw.replace(/^0+(?=\d)/, "");
  const grouped = wholeDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (fraction === null) return grouped;
  return `${grouped || "0"}.${fraction}`;
}

export function parseGroupedNumber(input: string): number {
  const value = Number(String(input).replace(/,/g, ""));
  return Number.isFinite(value) ? value : 0;
}

export interface RevenueGoalInput {
  /** Revenue to add during the selected period. */
  revenue: number;
  /** Average revenue per new customer. */
  averageRevenue: number;
  /** Logged meeting-booking rate, as a percent (3 = 3%). */
  closeRatePercent: number;
  sellingDaysPerWeek: number;
  repCount: number;
  period?: GoalPeriod;
}

export interface RevenueGoalPlan {
  customers: number;
  callsPeriod: number;
  weeks: number;
  callsQuarter: number;
  callsWeek: number;
  callsDay: number;
  callsPerRepDay: number;
}

export function planRevenueGoal(input: RevenueGoalInput): RevenueGoalPlan | null {
  const { revenue, averageRevenue: average, sellingDaysPerWeek: days, repCount } = input;
  const rate = input.closeRatePercent / 100;
  const period = input.period ?? "quarter";
  if (![revenue, average, rate, days, repCount].every(Number.isFinite) ||
      revenue <= 0 || average <= 0 || rate <= 0 || rate > 1 || days < 1 || days > 7 ||
      !Number.isInteger(days) || !Number.isInteger(repCount) || repCount < 1 || !Object.hasOwn(GOAL_PERIODS, period)) return null;

  const weeks = GOAL_PERIODS[period].weeks;
  const customers = Math.ceil(revenue / average);
  const callsPeriod = Math.ceil(customers / rate);
  const callsWeek = Math.ceil(callsPeriod / weeks);
  const callsDay = Math.ceil(callsWeek / days);
  const callsQuarter = period === "quarter" ? callsPeriod : Math.ceil(callsPeriod * WEEKS_PER_QUARTER / weeks);

  return {
    customers, callsPeriod, weeks, callsQuarter, callsWeek, callsDay,
    callsPerRepDay: Math.ceil(callsDay / repCount),
  };
}

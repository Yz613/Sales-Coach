export const WEEKS_PER_QUARTER = 13;

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
  /** Revenue to add this quarter. */
  revenue: number;
  /** Average revenue per new customer. */
  averageRevenue: number;
  /** Share of calls that become a customer, as a percent (3 = 3%). */
  closeRatePercent: number;
  sellingDaysPerWeek: number;
  repCount: number;
}

export interface RevenueGoalPlan {
  customers: number;
  callsQuarter: number;
  callsWeek: number;
  callsDay: number;
  callsPerRepDay: number;
}

export function planRevenueGoal(input: RevenueGoalInput): RevenueGoalPlan | null {
  const revenue = input.revenue;
  const average = input.averageRevenue;
  const rate = input.closeRatePercent / 100;
  const days = input.sellingDaysPerWeek;
  if (!(revenue > 0) || !(average > 0) || !(rate > 0) || !(days > 0)) return null;

  const customers = Math.ceil(revenue / average);
  const callsQuarter = Math.ceil(customers / rate);
  const callsWeek = Math.ceil(callsQuarter / WEEKS_PER_QUARTER);
  const callsDay = Math.ceil(callsWeek / days);
  const reps = Math.max(1, Math.round(input.repCount) || 1);

  return {
    customers,
    callsQuarter,
    callsWeek,
    callsDay,
    callsPerRepDay: Math.ceil(callsDay / reps),
  };
}

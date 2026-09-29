export const WEEKS_PER_QUARTER = 13;

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

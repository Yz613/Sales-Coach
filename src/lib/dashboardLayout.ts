export const DEFAULT_METRIC_ORDER = ["pain", "budget", "decision", "script"] as const;
export const DEFAULT_SECTION_ORDER = ["metrics", "reps", "leaks", "calls"] as const;

export type MetricId = (typeof DEFAULT_METRIC_ORDER)[number];
export type SectionId = (typeof DEFAULT_SECTION_ORDER)[number];

export const DASHBOARD_METRIC_STORAGE_KEY = "sc-dashboard-metric-order";
export const DASHBOARD_SECTION_STORAGE_KEY = "sc-dashboard-section-order";

export function applyOrder<T extends string>(order: T[], defaults: readonly T[]): T[] {
  const allowed = new Set(defaults);
  const cleaned = order.filter((id) => allowed.has(id));
  for (const id of defaults) {
    if (!cleaned.includes(id as T)) cleaned.push(id as T);
  }
  return cleaned;
}

export function moveId<T extends string>(order: T[], fromId: T, toId: T): T[] {
  if (fromId === toId) return order;
  const from = order.indexOf(fromId);
  const to = order.indexOf(toId);
  if (from < 0 || to < 0) return order;
  const next = [...order];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function readStoredOrder<T extends string>(key: string, defaults: readonly T[]): T[] {
  if (typeof window === "undefined") return [...defaults] as T[];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [...defaults] as T[];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...defaults] as T[];
    return applyOrder(parsed.filter((id) => typeof id === "string") as T[], defaults);
  } catch {
    return [...defaults] as T[];
  }
}

export function writeStoredOrder(key: string, order: string[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(order));
}

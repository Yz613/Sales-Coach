import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Base path the app is served under (mirrors `basePath` in next.config.ts).
// Next prepends this to <Link>/router and static assets automatically, but NOT
// to client-side fetch(), so use apiPath() for all client API calls.
export const BASE_PATH = "/app";

export function apiPath(path: string): string {
  return `${BASE_PATH}${path}`;
}

/** Resolve a stored audio/media URL against the app base path. */
export function mediaPath(url: string | null | undefined): string {
  if (!url) return "";
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  const normalized = url.startsWith("/") ? url : `/${url}`;
  if (normalized === BASE_PATH || normalized.startsWith(`${BASE_PATH}/`)) return normalized;
  return `${BASE_PATH}${normalized}`;
}

export function formatDate(dateString: string | Date | null | undefined): string {
  if (!dateString) return "N/A";
  const d = typeof dateString === "string" ? new Date(dateString) : dateString;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatUpdated(dateString: string | Date | null | undefined): string {
  return `Updated ${formatDate(dateString)}`;
}

/** "2 calls" — the number and the noun are always separated. */
export function formatCount(count: number, singular: string, plural = `${singular}s`): string {
  const n = Number.isFinite(count) ? Math.trunc(count) : 0;
  return `${n.toLocaleString("en-US")} ${n === 1 ? singular : plural}`;
}

const MAX_DURATION_SECONDS = 99 * 3600 + 59 * 60 + 59;

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || seconds === 0) return "0:00";
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > MAX_DURATION_SECONDS) return "—";
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const clock = `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  return hours > 0 ? `${hours}:${clock}` : `${mins}:${secs.toString().padStart(2, "0")}`;
}

/** Shared money display. Whole amounts render as "$100,000". */
export function formatCurrency(amount: number, currency = "USD"): string {
  if (!Number.isFinite(amount)) return "—";
  const code = /^[A-Z]{3}$/.test(currency) ? currency : "USD";
  const whole = Math.abs(amount - Math.round(amount)) < 0.001;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: code,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(whole ? Math.round(amount) : amount);
}

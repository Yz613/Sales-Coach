import { analyticsConnectHosts, analyticsScriptHosts } from "@/lib/analytics-policy";

// Public measurement id for https://refreshqueue.com. It is not a secret:
// the tag is served in the document so a deploy does not need a new env var.

export const MEASUREMENT_ID = "G-SRZXYYBKMT";

export const TAG_SCRIPT_SRC = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;

/** Hosts required to load the tag under a nonce CSP (ignored when strict-dynamic applies). */
export const tagScriptHosts = [
  "https://www.googletagmanager.com",
  "https://*.googletagmanager.com",
] as const;

/**
 * Collection endpoints for page views without ads features.
 * A CSP wildcard matches one label, so regional hosts are listed on their own.
 */
export const tagConnectHosts = [
  "https://www.googletagmanager.com",
  "https://*.googletagmanager.com",
  "https://www.google-analytics.com",
  "https://*.google-analytics.com",
  "https://analytics.google.com",
  "https://*.analytics.google.com",
] as const;

export const tagImgHosts = [
  "https://www.googletagmanager.com",
  "https://*.googletagmanager.com",
  "https://www.google-analytics.com",
  "https://*.google-analytics.com",
] as const;

const MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]+$/;

export type GtagFn = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: GtagFn;
  }
}

export type PageLocation = {
  href: string;
  pathname: string;
  search: string;
  hash: string;
};

export function pageViewParams(location: PageLocation, title: string) {
  return {
    send_to: MEASUREMENT_ID,
    page_title: title,
    page_location: location.href,
    page_path: `${location.pathname}${location.search}${location.hash}`,
  };
}

/** Queues the tag. A blocked or missing library must not throw into the page. */
export function pageViewBootstrap(measurementId = MEASUREMENT_ID): string {
  if (!MEASUREMENT_ID_PATTERN.test(measurementId)) return "try{}catch(e){}";
  return [
    "try{",
    "window.dataLayer=window.dataLayer||[];",
    "function gtag(){dataLayer.push(arguments);}",
    "window.gtag=gtag;",
    "gtag('js',new Date());",
    `gtag('config','${measurementId}',{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false});`,
    "}catch(e){}",
  ].join("");
}

/** Returns false when the tag is missing or throws, so callers can keep rendering. */
export function sendPageView(gtag: GtagFn | undefined, location: PageLocation, title: string): boolean {
  if (typeof gtag !== "function") return false;
  try {
    gtag("event", "page_view", pageViewParams(location, title));
    return true;
  } catch {
    return false;
  }
}

/** CSP used when Clerk is not configured. Production Clerk CSP merges the same hosts. */
export function fallbackContentSecurityPolicy(nonce: string, development: boolean): string {
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    ...(development ? ["'unsafe-eval'"] : []),
    ...tagScriptHosts,
    ...analyticsScriptHosts,
  ].join(" ");
  const connectSrc = ["'self'", ...(development ? ["ws:"] : []), ...tagConnectHosts, ...analyticsConnectHosts].join(" ");
  const imgSrc = ["'self'", "data:", "https://img.clerk.com", ...tagImgHosts].join(" ");
  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imgSrc}`,
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    "media-src 'self' https: blob:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
  ].join("; ");
}

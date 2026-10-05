// Helpers for the public URL path (includes Next `basePath`) vs the
// framework-stripped `nextUrl.pathname`. Raw `NextResponse.redirect`
// and `fetch()` do not get `basePath` prepended automatically.

import { isClerkProxyPath } from "./clerkProxy";

export const APP_BASE_PATH = "/app";
export { isClerkProxyPath };

export function getPublicPath(req: { url: string }): string {
  return new URL(req.url).pathname;
}

export function stripAppBasePath(pathname: string): string {
  if (pathname === APP_BASE_PATH) return "/";
  if (pathname.startsWith(`${APP_BASE_PATH}/`)) {
    return pathname.slice(APP_BASE_PATH.length) || "/";
  }
  return pathname;
}

export function toAppPath(path: string): string {
  const pathname = path.startsWith("/") ? path : `/${path}`;
  if (pathname === APP_BASE_PATH || pathname.startsWith(`${APP_BASE_PATH}/`)) {
    return pathname;
  }
  return `${APP_BASE_PATH}${pathname}`;
}

const PUBLIC_AUTH_PREFIXES = [
  "/sign-in",
  "/sign-up",
  "/select-organization",
  "/create-organization",
  "/user",
  "/session-recovery",
  "/organization",
  "/accept-invite",
  "/subscribe",
  "/workspaces",
  "/checkout",
];

export function isPublicAuthRoute(pathname: string): boolean {
  const normalized = stripAppBasePath(pathname);
  return PUBLIC_AUTH_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
  );
}

export function isPublicApiRoute(pathname: string, method: string): boolean {
  if (isClerkProxyPath(pathname) || isClerkProxyPath(stripAppBasePath(pathname))) return true;
  const normalized = stripAppBasePath(pathname);
  const verb = method.toUpperCase();
  if (normalized === "/api/auth/role" && verb === "GET") return true;
  if (normalized === "/api/auth/clerk-proxy" && (verb === "GET" || verb === "POST")) return true;
  if (normalized === "/api/auth/revoke-leaked-session" && (verb === "GET" || verb === "POST")) return true;
  if (normalized === "/api/billing/checkout" && (verb === "GET" || verb === "POST")) return true;
  if (normalized === "/api/billing/stripe-config" && (verb === "GET" || verb === "POST")) return true;
  if (["fathom", "stripe", "hubspot", "fireflies", "zapier", "make", "aircall"].some(provider => normalized === `/api/webhooks/${provider}`) && verb === "POST") return true;
  if (normalized === "/api/jobs/run" && verb === "POST") return true;
  if (normalized === INTEGRATION_REQUEST_API_PATH && verb === "POST") return true;
  if (normalized === VISITOR_COMPANY_API_PATH && (verb === "GET" || verb === "HEAD")) return true;
  return false;
}

export function isApiRoute(pathname: string): boolean {
  return stripAppBasePath(pathname).startsWith("/api/");
}

export function isBareCallsPath(pathname: string): boolean {
  return pathname === "/calls" || pathname.startsWith("/calls/");
}

export function isApexFaviconPath(pathname: string): boolean {
  return pathname === "/favicon.ico" || pathname === "/icon.svg";
}

/** Next route (after basePath) that renders the public marketing landing. */
export const MARKETING_PAGE_PATH = "/marketing";

/** Public integrations catalog. Apex `/integrations` rewrites here on the hosted site. */
export const INTEGRATIONS_PAGE_PATH = "/integrations";

/** Public privacy policy. Apex `/privacy` rewrites here on the hosted site. */
export const PRIVACY_PAGE_PATH = "/privacy";

/** Metadata routes. Apex `/robots.txt` and `/sitemap.xml` rewrite onto the app base path. */
export const ROBOTS_PATH = "/robots.txt";
export const SITEMAP_PATH = "/sitemap.xml";

/**
 * Internal target for an apex URL the app does not serve.
 * The page calls `notFound()` so the response is the app 404.
 */
export const NOT_FOUND_PAGE_PATH = "/site-missing";

/** Absolute paths listed in `src/app/sitemap.ts`. `/pricing` is a redirect, not a page. */
export const PUBLIC_SITEMAP_PATHS = ["/", INTEGRATIONS_PAGE_PATH, PRIVACY_PAGE_PATH] as const;

/** Unauthenticated POST target for the public integration request form. */
export const INTEGRATION_REQUEST_API_PATH = "/api/marketing/integration-request";

/**
 * Unauthenticated GET/HEAD target for company-level visitor tagging.
 * Public URL is `/app/api/visitor-company` (`basePath` + this path).
 */
export const VISITOR_COMPANY_API_PATH = "/api/visitor-company";

export function isApexPricingPath(pathname: string): boolean {
  return pathname === "/pricing" || pathname === "/pricing/";
}

/**
 * Next `usePathname()` / stripped paths for the marketing page (`/marketing`).
 * Do not use this for apex `/` — with `basePath: "/app"`, the dashboard is also `/`.
 */
export function isSubscribePath(pathname: string): boolean {
  const normalized = stripAppBasePath(pathname);
  return normalized === "/subscribe" || normalized.startsWith("/subscribe/");
}

export function isCheckoutPath(pathname: string): boolean {
  const normalized = stripAppBasePath(pathname);
  return normalized === "/checkout" || normalized.startsWith("/checkout/");
}

export function isApexIntegrationsPath(pathname: string): boolean {
  return pathname === INTEGRATIONS_PAGE_PATH || pathname === `${INTEGRATIONS_PAGE_PATH}/`;
}

export function isApexPrivacyPath(pathname: string): boolean {
  return pathname === PRIVACY_PAGE_PATH || pathname === `${PRIVACY_PAGE_PATH}/`;
}

export function isApexRobotsPath(pathname: string): boolean {
  return pathname === ROBOTS_PATH;
}

export function isApexSitemapPath(pathname: string): boolean {
  return pathname === SITEMAP_PATH;
}

export function isNotFoundPath(pathname: string): boolean {
  const normalized = stripAppBasePath(pathname);
  return normalized === NOT_FOUND_PAGE_PATH || normalized === `${NOT_FOUND_PAGE_PATH}/`;
}

export function isPublicDocumentPath(pathname: string): boolean {
  const normalized = stripAppBasePath(pathname);
  return isApexRobotsPath(normalized) || isApexSitemapPath(normalized);
}

export function isMarketingAppPath(pathname: string): boolean {
  const normalized = stripAppBasePath(pathname);
  return (
    normalized === MARKETING_PAGE_PATH ||
    normalized.startsWith(`${MARKETING_PAGE_PATH}/`) ||
    isApexIntegrationsPath(normalized) ||
    isApexPrivacyPath(normalized) ||
    isNotFoundPath(normalized)
  );
}

/**
 * Public site paths that skip sign-in: apex `/`, marketing, integrations,
 * privacy, the not-found page, robots.txt, and sitemap.xml.
 * Pass the full public URL pathname (`getPublicPath`), not `usePathname()`.
 * `/app` (the admin dashboard) must stay authenticated.
 */
export function isPublicMarketingPath(pathname: string): boolean {
  if (pathname === "/" || pathname === "") return true;
  if (isPublicDocumentPath(pathname)) return true;
  return isMarketingAppPath(pathname);
}

export type ApexAliasRedirect = {
  location: string;
  status: 307 | 308;
};

/**
 * Apex paths that never enter Next middleware under `basePath: "/app"`.
 * Used by next.config redirects, middleware (when it does run), and the
 * Cloudflare worker wrapper in front of OpenNext.
 *
 * `/pricing` redirects to the landing hash. Apex `/` is an internal rewrite
 * (see `getApexMarketingRewrite`) so the URL stays `/`.
 */
export function isApexClerkProxyPath(pathname: string): boolean {
  return pathname === "/__auth" || pathname.startsWith("/__auth/") || pathname === "/__clerk" || pathname.startsWith("/__clerk/");
}

export function getApexAliasRedirect(requestUrl: string): ApexAliasRedirect | null {
  const url = new URL(requestUrl);
  let normalized = url.pathname;
  while (normalized === "/app/app" || normalized.startsWith("/app/app/")) normalized = normalized.slice(APP_BASE_PATH.length);
  if (normalized !== url.pathname) {
    url.pathname = normalized;
    return { location: url.href, status: 307 };
  }
  if (isApexClerkProxyPath(url.pathname)) {
    const dest = new URL(url);
    dest.pathname = url.pathname.startsWith("/__clerk")
      ? `/app/__auth${url.pathname.slice("/__clerk".length)}`
      : `/app${url.pathname}`;
    return { location: dest.href, status: 307 };
  }
  if (isApexFaviconPath(url.pathname)) {
    return { location: new URL(toAppPath("/icon.svg"), url.origin).href, status: 308 };
  }
  if (isBareCallsPath(url.pathname)) {
    const dest = new URL(toAppPath(url.pathname), url);
    dest.search = url.search;
    return { location: dest.href, status: 308 };
  }
  if (isApexPricingPath(url.pathname)) {
    return { location: `${url.origin}/#pricing`, status: 308 };
  }
  return null;
}

/**
 * Internal rewrite target so apex `/` serves the marketing page without
 * changing the browser URL to `/app/marketing`.
 */
export function getApexMarketingRewrite(requestUrl: string): string | null {
  const url = new URL(requestUrl);
  if (url.pathname !== "/" && url.pathname !== "") return null;
  const dest = new URL(toAppPath(MARKETING_PAGE_PATH), url.origin);
  dest.search = url.search;
  return dest.href;
}

/**
 * Internal rewrite so apex `/integrations` serves the catalog without
 * changing the browser URL to `/app/integrations`.
 */
export function getApexIntegrationsRewrite(requestUrl: string): string | null {
  const url = new URL(requestUrl);
  if (!isApexIntegrationsPath(url.pathname)) return null;
  const dest = new URL(toAppPath(INTEGRATIONS_PAGE_PATH), url.origin);
  dest.search = url.search;
  return dest.href;
}

function rewriteExactApex(requestUrl: string, matches: (pathname: string) => boolean, target: string): string | null {
  const url = new URL(requestUrl);
  if (!matches(url.pathname)) return null;
  const dest = new URL(toAppPath(target), url.origin);
  dest.search = url.search;
  return dest.href;
}

export function getApexPrivacyRewrite(requestUrl: string): string | null {
  return rewriteExactApex(requestUrl, isApexPrivacyPath, PRIVACY_PAGE_PATH);
}

export function getApexRobotsRewrite(requestUrl: string): string | null {
  return rewriteExactApex(requestUrl, isApexRobotsPath, ROBOTS_PATH);
}

export function getApexSitemapRewrite(requestUrl: string): string | null {
  return rewriteExactApex(requestUrl, isApexSitemapPath, SITEMAP_PATH);
}

/** Internal rewrite that keeps the browser on the apex URL. */
export function getApexContentRewrite(requestUrl: string): string | null {
  return (
    getApexMarketingRewrite(requestUrl) ||
    getApexIntegrationsRewrite(requestUrl) ||
    getApexPrivacyRewrite(requestUrl) ||
    getApexRobotsRewrite(requestUrl) ||
    getApexSitemapRewrite(requestUrl)
  );
}

/** Paths OpenNext already owns. Apex misses must not be treated as these. */
export function isWorkerPassthroughPath(pathname: string): boolean {
  return (
    pathname === APP_BASE_PATH ||
    pathname.startsWith(`${APP_BASE_PATH}/`) ||
    pathname.startsWith("/_next/") ||
    pathname === "/cdn-cgi" ||
    pathname.startsWith("/cdn-cgi/")
  );
}

/**
 * Apex URL with no page, redirect, or asset route. Fetch `NOT_FOUND_PAGE_PATH`
 * and return that response as 404. `/integrations/logo.svg` is included so a
 * missing file is a 404; real files are served by the assets layer first.
 */
export function getApexNotFoundRewrite(requestUrl: string): string | null {
  const url = new URL(requestUrl);
  if (getApexAliasRedirect(requestUrl) || getApexContentRewrite(requestUrl)) return null;
  if (isWorkerPassthroughPath(url.pathname)) return null;
  return new URL(toAppPath(NOT_FOUND_PAGE_PATH), url.origin).href;
}

export type ApexWorkerAction =
  | { type: "redirect"; location: string; status: 307 | 308 }
  | { type: "rewrite"; url: string }
  | { type: "not-found"; url: string }
  | { type: "passthrough" };

/**
 * What the Cloudflare worker should do before OpenNext.
 * Redirects run first so `/pricing` cannot bounce through another redirect.
 */
export function apexWorkerAction(requestUrl: string): ApexWorkerAction {
  const alias = getApexAliasRedirect(requestUrl);
  if (alias) return { type: "redirect", location: alias.location, status: alias.status };
  const rewrite = getApexContentRewrite(requestUrl);
  if (rewrite) return { type: "rewrite", url: rewrite };
  const missing = getApexNotFoundRewrite(requestUrl);
  if (missing) return { type: "not-found", url: missing };
  return { type: "passthrough" };
}

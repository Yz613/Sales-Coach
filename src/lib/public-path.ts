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
  "/organization",
  "/accept-invite",
  "/subscribe",
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
  if (normalized === "/api/billing/checkout" && (verb === "GET" || verb === "POST")) return true;
  if (normalized === "/api/billing/stripe-config" && (verb === "GET" || verb === "POST")) return true;
  if (normalized.startsWith("/api/webhooks/")) return true;
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

export function isMarketingAppPath(pathname: string): boolean {
  const normalized = stripAppBasePath(pathname);
  return (
    normalized === MARKETING_PAGE_PATH ||
    normalized.startsWith(`${MARKETING_PAGE_PATH}/`)
  );
}

/**
 * True apex `/` (marketing) or the `/app/marketing` preview route.
 * Pass the full public URL pathname (`getPublicPath`), not `usePathname()`.
 * `/app` (the admin dashboard) must stay authenticated.
 */
export function isPublicMarketingPath(pathname: string): boolean {
  if (pathname === "/" || pathname === "") return true;
  return isMarketingAppPath(pathname);
}

export type ApexAliasRedirect = {
  location: string;
  status: 308;
};

/**
 * Apex paths that never enter Next middleware under `basePath: "/app"`.
 * Used by next.config redirects, middleware (when it does run), and the
 * Cloudflare worker wrapper in front of OpenNext.
 *
 * `/pricing` redirects to the landing hash. Apex `/` is an internal rewrite
 * (see `getApexMarketingRewrite`) so the URL stays `/`.
 */
export function getApexAliasRedirect(requestUrl: string): ApexAliasRedirect | null {
  const url = new URL(requestUrl);
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

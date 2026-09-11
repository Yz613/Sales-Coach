// Helpers for the public URL path (includes Next `basePath`) vs the
// framework-stripped `nextUrl.pathname`. Raw `NextResponse.redirect`
// and `fetch()` do not get `basePath` prepended automatically.

export const APP_BASE_PATH = "/app";

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
];

export function isPublicAuthRoute(pathname: string): boolean {
  const normalized = stripAppBasePath(pathname);
  return PUBLIC_AUTH_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
  );
}

export function isPublicApiRoute(pathname: string, method: string): boolean {
  const normalized = stripAppBasePath(pathname);
  if (normalized === "/api/auth/role" && method.toUpperCase() === "GET") return true;
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

export type ApexAliasRedirect = {
  location: string;
  status: 308;
};

/**
 * Apex paths that never enter Next middleware under `basePath: "/app"`.
 * Used by next.config redirects, middleware (when it does run), and the
 * Cloudflare worker wrapper in front of OpenNext.
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
  return null;
}

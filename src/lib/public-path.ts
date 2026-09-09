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

export function isPublicAuthRoute(pathname: string): boolean {
  const normalized = stripAppBasePath(pathname);
  return normalized.startsWith("/sign-in") || normalized.startsWith("/sign-up");
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
  return pathname === "/favicon.ico";
}

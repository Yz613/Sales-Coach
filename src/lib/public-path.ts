import { SITE_URL } from "./site";

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

/** Public marketing page — no Clerk sign-in required. */
export function isMarketingRoute(pathname: string): boolean {
  const normalized = stripAppBasePath(pathname);
  return normalized === "/home" || normalized.startsWith("/home/");
}

/** Public marketing page and apex SEO files — no Clerk sign-in required. */
export function isPublicContentRoute(pathname: string): boolean {
  if (isMarketingRoute(pathname)) return true;
  const normalized = stripAppBasePath(pathname);
  return normalized === "/robots.txt" || normalized === "/sitemap.xml";
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

export type ApexInternalRewrite = {
  destination: string;
};

const APEX_REWRITE_PATHS: Record<string, string> = {
  "/": `${APP_BASE_PATH}/home`,
  "/robots.txt": `${APP_BASE_PATH}/robots.txt`,
  "/sitemap.xml": `${APP_BASE_PATH}/sitemap.xml`,
};

/**
 * Keep the browser URL on the domain apex (`/`, `/robots.txt`, `/sitemap.xml`)
 * while OpenNext serves the matching `/app/...` route. Used by the Cloudflare
 * worker in front of OpenNext — Next middleware never sees a bare `/`.
 */
export function getApexInternalRewrite(
  requestUrl: string,
  method = "GET"
): ApexInternalRewrite | null {
  const verb = method.toUpperCase();
  if (verb !== "GET" && verb !== "HEAD") return null;

  const url = new URL(requestUrl);
  const pathname = url.pathname === "" ? "/" : url.pathname;
  const destPath = APEX_REWRITE_PATHS[pathname];
  if (!destPath) return null;

  url.pathname = destPath;
  return { destination: url.href };
}

export type ApexSeoFile = {
  body: string;
  contentType: string;
};

/** Plain robots/sitemap at the domain apex so crawlers do not need `/app`. */
export function getApexSeoFile(requestUrl: string): ApexSeoFile | null {
  const pathname = new URL(requestUrl).pathname;
  if (pathname === "/robots.txt") {
    return {
      contentType: "text/plain; charset=utf-8",
      body: `User-agent: *\nAllow: /\nDisallow: /app/\nSitemap: ${SITE_URL}/sitemap.xml\n`,
    };
  }
  if (pathname === "/sitemap.xml") {
    return {
      contentType: "application/xml; charset=utf-8",
      body: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${SITE_URL}/</loc>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>\n</urlset>\n`,
    };
  }
  return null;
}

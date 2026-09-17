export const CLERK_PROXY_PATHS = ["/app/__auth", "/__auth", "/__clerk"] as const;
export const CLERK_PROXY_PUBLIC_PATH = "/app/__auth";
export const CLERK_PROXY_NEXT_PATH = "/__auth";
export const CLERK_FAPI_ORIGIN = "https://clerk.refreshqueue.com";
export const CLERK_JS_PROXY_FILE = "sdk.js";
export const CLERK_JS_UPSTREAM_FILE = "clerk.browser.js";
export const CLERK_UI_PROXY_FILE = "ui.js";
export const CLERK_UI_UPSTREAM_FILE = "ui.browser.js";
export const CLERK_JS_PROXY_SRC = `${CLERK_PROXY_PUBLIC_PATH}/npm/@clerk/clerk-js@6/dist/${CLERK_JS_PROXY_FILE}`;
export const CLERK_UI_PROXY_SRC = `${CLERK_PROXY_PUBLIC_PATH}/npm/@clerk/ui@1/dist/${CLERK_UI_PROXY_FILE}`;

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

const RESPONSE_STRIP = new Set(["content-encoding", "content-length"]);

export function matchClerkProxyPath(pathname: string): string | null {
  for (const prefix of CLERK_PROXY_PATHS) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return prefix;
  }
  return null;
}

export function isClerkProxyPath(pathname: string): boolean {
  return matchClerkProxyPath(pathname) !== null;
}

export function disguiseClerkAssetPath(pathname: string): string {
  if (pathname.endsWith(`/${CLERK_JS_UPSTREAM_FILE}`)) {
    return `${pathname.slice(0, -CLERK_JS_UPSTREAM_FILE.length)}${CLERK_JS_PROXY_FILE}`;
  }
  if (pathname.endsWith(`/${CLERK_UI_UPSTREAM_FILE}`)) {
    return `${pathname.slice(0, -CLERK_UI_UPSTREAM_FILE.length)}${CLERK_UI_PROXY_FILE}`;
  }
  return pathname;
}

export function rewriteClerkProxyRest(pathname: string, prefix: string): string {
  let rest = pathname.slice(prefix.length) || "/";
  if (!rest.startsWith("/")) rest = `/${rest}`;
  if (rest.endsWith(`/${CLERK_JS_PROXY_FILE}`)) {
    return `${rest.slice(0, -CLERK_JS_PROXY_FILE.length)}${CLERK_JS_UPSTREAM_FILE}`;
  }
  if (rest.endsWith(`/${CLERK_UI_PROXY_FILE}`)) {
    return `${rest.slice(0, -CLERK_UI_PROXY_FILE.length)}${CLERK_UI_UPSTREAM_FILE}`;
  }
  return rest;
}

export function clerkProxyPublicUrl(origin = "https://refreshqueue.com"): string {
  return `${origin.replace(/\/$/, "")}${CLERK_PROXY_PUBLIC_PATH}`;
}

function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    ""
  );
}

export async function forwardClerkProxyRequest(
  request: Request,
  env: { CLERK_SECRET_KEY?: string }
): Promise<Response> {
  const url = new URL(request.url);
  const prefix = matchClerkProxyPath(url.pathname);
  if (!prefix) {
    return Response.json({ error: "Not a Clerk proxy path." }, { status: 404 });
  }
  const secret = (env.CLERK_SECRET_KEY || "").trim();
  if (!secret) {
    return Response.json({ error: "Clerk proxy is not configured." }, { status: 503 });
  }

  const rest = rewriteClerkProxyRest(url.pathname, prefix);
  const target = new URL(rest + url.search, CLERK_FAPI_ORIGIN);
  if (target.origin !== CLERK_FAPI_ORIGIN) {
    return Response.json({ error: "Invalid Clerk proxy target." }, { status: 400 });
  }

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (!HOP_BY_HOP.has(lower) && lower !== "host") headers.set(key, value);
  });
  const proxyUrl = `${url.origin}${prefix}`;
  headers.set("Clerk-Proxy-Url", proxyUrl);
  headers.set("Clerk-Secret-Key", secret);
  headers.set("Host", new URL(CLERK_FAPI_ORIGIN).host);
  headers.set("Accept-Encoding", "identity");
  headers.set("X-Forwarded-Host", url.host);
  headers.set("X-Forwarded-Proto", url.protocol.replace(":", ""));
  const ip = clientIp(request);
  if (ip) headers.set("X-Forwarded-For", ip);

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
  };
  if (request.method !== "GET" && request.method !== "HEAD" && request.body) {
    (init as RequestInit & { duplex?: string }).duplex = "half";
    init.body = request.body;
  }

  const upstream = await fetch(target, init);
  const out = new Headers();
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP.has(lower) || RESPONSE_STRIP.has(lower)) return;
    if (lower === "set-cookie") out.append(key, value);
    else out.set(key, value);
  });
  const location = upstream.headers.get("location");
  if (location) {
    try {
      const loc = new URL(location, CLERK_FAPI_ORIGIN);
      if (loc.origin === CLERK_FAPI_ORIGIN) {
        const path = disguiseClerkAssetPath(loc.pathname);
        out.set("Location", `${proxyUrl}${path}${loc.search}${loc.hash}`);
      }
    } catch {
      // Keep Clerk's original Location for external IdP redirects.
    }
  }
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: out,
  });
}

type ClerkDomain = {
  id?: string;
  name?: string;
  proxy_url?: string | null;
  is_satellite?: boolean;
};

export async function enableClerkFrontendProxy(
  secretKey: string,
  proxyUrl: string
): Promise<{ configured: boolean; domainId: string | null; already: boolean; error?: string }> {
  const headers = {
    Authorization: `Bearer ${secretKey}`,
    "Content-Type": "application/json",
  };
  const listRes = await fetch("https://api.clerk.com/v1/domains", { headers });
  const listJson = (await listRes.json().catch(() => ({}))) as {
    data?: ClerkDomain[];
    errors?: { message?: string }[];
  };
  if (!listRes.ok) {
    return {
      configured: false,
      domainId: null,
      already: false,
      error: listJson.errors?.[0]?.message || "Unable to list Clerk domains.",
    };
  }
  const domains = listJson.data || [];
  const primary = domains.find((d) => !d.is_satellite) || domains[0];
  if (!primary?.id) {
    return { configured: false, domainId: null, already: false, error: "No Clerk production domain found." };
  }
  const current = (primary.proxy_url || "").replace(/\/$/, "");
  const wanted = proxyUrl.replace(/\/$/, "");
  if (current === wanted) {
    return { configured: true, domainId: primary.id, already: true };
  }
  const patchRes = await fetch(`https://api.clerk.com/v1/domains/${primary.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ proxy_url: wanted }),
  });
  const patchJson = (await patchRes.json().catch(() => ({}))) as { errors?: { message?: string }[] };
  if (!patchRes.ok) {
    return {
      configured: false,
      domainId: primary.id,
      already: false,
      error: patchJson.errors?.[0]?.message || "Clerk rejected the proxy URL.",
    };
  }
  return { configured: true, domainId: primary.id, already: false };
}

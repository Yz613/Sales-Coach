/** Assumption: production is internet facing; unauthenticated mode is for local development only. */
export function localDevelopmentAllowed(env: Record<string, string | undefined> = process.env): boolean {
  return env.NODE_ENV !== "production" && !env.CLERK_SECRET_KEY?.trim() && !env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
}

export class SecurityPolicyError extends Error {
  constructor(message: string, public status = 403, public code = "SECURITY_POLICY") { super(message); }
}

export function mfaRequired(env: Record<string, string | undefined> = process.env): boolean {
  const configured = env.REQUIRE_MFA?.trim().toLowerCase();
  if (["true", "1"].includes(configured || "")) return true;
  if (["false", "0"].includes(configured || "")) return false;
  return env.NODE_ENV === "production";
}

/** Clerk's signed factor-verification ages are minutes; -1 means no second factor was verified. */
export function sessionHasMfa(claims: unknown): boolean {
  if (!claims || typeof claims !== "object") return false;
  const ages = (claims as { fva?: unknown }).fva;
  return Array.isArray(ages) && ages.length === 2 && typeof ages[1] === "number" &&
    Number.isFinite(ages[1]) && ages[1] >= 0 && ages[1] <= 480;
}

export function configuredAppOrigin(env: Record<string, string | undefined> = process.env): string | null {
  const value = env.PUBLIC_APP_URL?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.username || url.password || (env.NODE_ENV === "production" && url.protocol !== "https:")) return null;
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch { return null; }
}

export function assertSecureDeployment(env: Record<string, string | undefined> = process.env): void {
  if (env.NODE_ENV !== "production") return;
  const key = env.INTEGRATION_ENCRYPTION_KEY?.trim() || "";
  // A canonical encoding prevents silently accepting truncated or malformed key material.
  if (!env.CLERK_SECRET_KEY?.trim() || !env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() ||
      !configuredAppOrigin(env) || !/^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw048]=$/.test(key)) {
    throw new SecurityPolicyError("Service security configuration is incomplete.", 503, "SECURITY_CONFIGURATION");
  }
}

export function assertMutationOrigin(req: Request, env: Record<string, string | undefined> = process.env): void {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const origin = req.headers.get("origin");
  const site = req.headers.get("sec-fetch-site");
  const expected = configuredAppOrigin(env) || (env.NODE_ENV !== "production" ? new URL(req.url).origin : null);
  if (site === "cross-site" || (origin && (!expected || origin !== expected))) {
    throw new SecurityPolicyError("Cross-origin requests are not allowed.");
  }
  // Non-browser API clients may omit Origin; their verified authentication is still required.
}

export function assertLocalRequest(req: Request): void {
  if (!localDevelopmentAllowed()) return;
  const hostname = new URL(req.url).hostname;
  if (!["localhost", "127.0.0.1", "[::1]"].includes(hostname)) {
    throw new SecurityPolicyError("Local development access requires a loopback address.");
  }
}

export async function boundedRequest(req: Request, maximum: number): Promise<Request> {
  const declared = req.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > maximum)) {
    throw new SecurityPolicyError("Request body is too large.", 413, "BODY_TOO_LARGE");
  }
  if (!req.body) return req;
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maximum) {
        await reader.cancel();
        throw new SecurityPolicyError("Request body is too large.", 413, "BODY_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  // Preserve NextRequest.nextUrl for handlers that use it, without parsing an unbounded stream.
  const { NextRequest } = await import("next/server");
  return new NextRequest(req, { body: bytes });
}

export function privateResponse(response: Response): Response {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}

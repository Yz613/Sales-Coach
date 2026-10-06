import { createHash } from "node:crypto";
import { sql, lt, eq } from "drizzle-orm";
import { db, ensureRevenueSchema } from "./db";
import { securityRateLimits } from "./db/schema";
import type { AuthUser } from "./auth";
import { SecurityPolicyError } from "./security-policy";

/** Atomic database counters are shared across workers and server processes. No raw email or token is stored. */
export async function consumeLimit(identity: string, limit: number, windowMs = 60_000, now = Date.now()): Promise<void> {
  await ensureRevenueSchema();
  const window = Math.floor(now / windowMs);
  const id = createHash("sha256").update(`${identity}:${window}:${windowMs}`).digest("hex");
  const row = await db.insert(securityRateLimits).values({ id, count: 1, expiresAt: (window + 1) * windowMs })
    .onConflictDoUpdate({ target: securityRateLimits.id, set: { count: sql`${securityRateLimits.count} + 1` },
      setWhere: sql`${securityRateLimits.count} < ${limit}` }).returning({ count: securityRateLimits.count }).get();
  if (!row) throw new SecurityPolicyError("Too many requests. Try again shortly.", 429, "RATE_LIMITED");
  // Bound counter storage even when an attacker varies object IDs and paths.
  await db.delete(securityRateLimits).where(lt(securityRateLimits.expiresAt, now - 60_000)).run();
}

export async function consumeRequestLimit(req: Request, auth: AuthUser): Promise<void> {
  const path = new URL(req.url).pathname;
  const mutation = !["GET", "HEAD"].includes(req.method);
  const expensive = mutation && /\/(?:upload|batch-upload|evaluate|reanalyze|process|sync|connect|conversations|integrations|jobs)(?:\/|$)/.test(path);
  const identity = `${auth.tenantId}:${auth.userId || "local"}`;
  await consumeLimit(`${identity}:all`, 300);
  if (mutation) await consumeLimit(`${identity}:mutations`, 60);
  if (expensive) await consumeLimit(`${identity}:processing`, 10);
}

/** Failure budgets are checked before credential decryption or signature work. */
export async function assertFailureBudget(identity: string, limit = 20, now = Date.now()) {
  await ensureRevenueSchema();
  const id = createHash("sha256").update(`${identity}:${Math.floor(now / 60000)}:60000`).digest("hex");
  const row = await db.select({ count: securityRateLimits.count }).from(securityRateLimits).where(eq(securityRateLimits.id, id)).get();
  if (row && row.count >= limit) throw new SecurityPolicyError("Too many failed requests. Try again shortly.", 429, "RATE_LIMITED");
}

export function publicWebhookBudget(request: Request) {
  const url = new URL(request.url);
  const provider = url.pathname.endsWith("/jobs/run") ? "jobs" : url.pathname.split("/").pop() || "unknown";
  const limits: Record<string, number> = { fathom: 2 * 1024 * 1024, quo: 2 * 1024 * 1024, hubspot: 128 * 1024, fireflies: 128 * 1024, aircall: 256 * 1024, zapier: 1024 * 1024, make: 1024 * 1024, stripe: 256 * 1024, jobs: 8 * 1024 };
  const key = Object.hasOwn(limits, provider) ? provider : "unknown";
  const connection = url.searchParams.get("connection") || "";
  // Opaque IDs are bounded; endpoint budgets cap cardinality even for random UUIDs.
  const validId = /^[a-zA-Z0-9_-]{1,100}$/.test(connection) ? connection : "none";
  return { identity: `public:webhook:${key}`, connection: `public:webhook:${key}:${validId}`, bodyLimit: limits[key] || 128 * 1024, requests: key === "jobs" ? 60 : 600 };
}

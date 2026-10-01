import { createHash } from "node:crypto";
import { sql, lt } from "drizzle-orm";
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

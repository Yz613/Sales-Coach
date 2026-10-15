import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db, ensureRevenueSchema } from "./db";
import { apiTokens } from "./db/schema";
import type { AuthUser } from "./auth";
import { currentTenantId, LOCAL_TENANT_ID } from "./tenant";
import { localDevelopmentAllowed } from "./security-policy";
import { RevenueError } from "./revenue/security";

export interface ApiTokenInfo {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token.trim()).digest("hex");
}

export async function createApiToken(
  name: string,
  auth: AuthUser
): Promise<{ id: string; name: string; token: string; prefix: string; createdAt: string }> {
  await ensureRevenueSchema();
  const trimmedName = (name || "").trim().slice(0, 100);
  if (!trimmedName) throw new RevenueError("Token name is required.");

  const orgId = auth.orgId || auth.tenantId || currentTenantId() || LOCAL_TENANT_ID;
  const userId = auth.userId || "local-user";
  const rawSecret = randomBytes(24).toString("hex");
  const fullToken = `sc_live_${rawSecret}`;
  const tokenHash = hashToken(fullToken);
  const prefix = fullToken.slice(0, 16) + "...";
  const id = `tok_${randomUUID()}`;
  const createdAt = new Date().toISOString();

  const role = auth.role || (auth.isAdmin ? "admin" : "member");
  const canViewAllCalls = auth.canViewAllCalls ? 1 : 0;
  const metadata = JSON.stringify({
    isAdmin: Boolean(auth.isAdmin),
    isMember: Boolean(auth.isMember),
    canViewAllCalls: Boolean(auth.canViewAllCalls),
    email: auth.email || null,
    name: auth.name || null,
  });

  await db.insert(apiTokens).values({
    id,
    orgId,
    userId,
    name: trimmedName,
    tokenHash,
    tokenPrefix: prefix,
    role,
    canViewAllCalls,
    metadata,
    createdAt,
    lastUsedAt: null,
    expiresAt: null,
  }).run();

  return {
    id,
    name: trimmedName,
    token: fullToken,
    prefix,
    createdAt,
  };
}

export async function listApiTokens(auth: AuthUser): Promise<ApiTokenInfo[]> {
  await ensureRevenueSchema();
  const orgId = auth.orgId || auth.tenantId || currentTenantId() || LOCAL_TENANT_ID;

  const conditions = [eq(apiTokens.orgId, orgId)];
  if (!auth.isAdmin && auth.userId) {
    conditions.push(eq(apiTokens.userId, auth.userId));
  }

  const rows = await db
    .select({
      id: apiTokens.id,
      name: apiTokens.name,
      prefix: apiTokens.tokenPrefix,
      createdAt: apiTokens.createdAt,
      lastUsedAt: apiTokens.lastUsedAt,
    })
    .from(apiTokens)
    .where(and(...conditions))
    .orderBy(desc(apiTokens.createdAt))
    .all();

  return rows;
}

export async function revokeApiToken(id: string, auth: AuthUser): Promise<boolean> {
  await ensureRevenueSchema();
  const orgId = auth.orgId || auth.tenantId || currentTenantId() || LOCAL_TENANT_ID;

  const conditions = [eq(apiTokens.id, id), eq(apiTokens.orgId, orgId)];
  if (!auth.isAdmin && auth.userId) {
    conditions.push(eq(apiTokens.userId, auth.userId));
  }

  const result = await db
    .delete(apiTokens)
    .where(and(...conditions))
    .run();

  return Boolean(result);
}

export async function authenticateApiToken(tokenHeaderOrParam: string | null): Promise<AuthUser | null> {
  if (!tokenHeaderOrParam) return null;

  const raw = tokenHeaderOrParam.startsWith("Bearer ")
    ? tokenHeaderOrParam.slice(7).trim()
    : tokenHeaderOrParam.trim();

  if (!raw) return null;

  await ensureRevenueSchema();
  const tokenHash = hashToken(raw);

  const matched = await db
    .select()
    .from(apiTokens)
    .where(eq(apiTokens.tokenHash, tokenHash))
    .get();

  if (matched) {
    // Record usage
    try {
      await db
        .update(apiTokens)
        .set({ lastUsedAt: new Date().toISOString() })
        .where(eq(apiTokens.id, matched.id))
        .run();
    } catch {
      // non-fatal
    }

    let meta: any = {};
    try {
      meta = (matched as any).metadata ? JSON.parse((matched as any).metadata) : {};
    } catch {
      meta = {};
    }

    const isAdmin = meta.isAdmin ?? ((matched as any).role === "admin");
    const canViewAllCalls = meta.canViewAllCalls ?? ((matched as any).canViewAllCalls === 1 || isAdmin);
    const email = meta.email || undefined;
    const name = meta.name || undefined;
    const role: UserRole = (matched as any).role === "admin" ? "admin" : "member";

    return {
      userId: matched.userId,
      role,
      isAdmin,
      isMember: !isAdmin,
      isClerkConfigured: false,
      orgId: matched.orgId,
      canViewAllCalls,
      email,
      name,
      tenantId: matched.orgId,
      clerkPlanId: null,
      billingPaid: true,
    };
  }

  // Fallback for local development
  if (localDevelopmentAllowed() && (raw === "local" || raw === "dev" || raw.startsWith("sc_local_"))) {
    return {
      userId: "local-user",
      role: "admin",
      isAdmin: true,
      isMember: false,
      isClerkConfigured: false,
      orgId: LOCAL_TENANT_ID,
      canViewAllCalls: true,
      tenantId: LOCAL_TENANT_ID,
      clerkPlanId: null,
      billingPaid: true,
    };
  }

  return null;
}

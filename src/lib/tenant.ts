import { AsyncLocalStorage } from "node:async_hooks";
import { hasClerkServerAuth } from "@/lib/clerk-env";

/** Standalone / open-source workspace. Never used as a Clerk org id. */
export const LOCAL_TENANT_ID = "local";

const tenantStore = new AsyncLocalStorage<string>();

export class TenantRequiredError extends Error {
  status = 401;
  code = "TENANT_REQUIRED";

  constructor(message = "Choose a team to continue.") {
    super(message);
    this.name = "TenantRequiredError";
  }
}

export function resolveTenantId(auth: {
  isClerkConfigured: boolean;
  orgId?: string | null;
}): string {
  if (!auth.isClerkConfigured) return LOCAL_TENANT_ID;
  const orgId = (auth.orgId || "").trim();
  if (!orgId || orgId === LOCAL_TENANT_ID || orgId === "workspace") {
    throw new TenantRequiredError();
  }
  return orgId;
}

export function bindTenant(tenantId: string): void {
  tenantStore.enterWith(tenantId);
}

export function runWithTenant<T>(tenantId: string, fn: () => T): T {
  return tenantStore.run(tenantId, fn);
}

/**
 * Active workspace id for DB reads/writes.
 * Fail closed when Clerk is on and no org was bound — never fall back to a
 * shared "workspace" bucket (that leaked locked-account data).
 */
export function currentTenantId(): string {
  const bound = tenantStore.getStore();
  if (bound) return bound;
  if (!hasClerkServerAuth()) return LOCAL_TENANT_ID;
  throw new TenantRequiredError("Workspace is not scoped to a team.");
}

export function settingStorageKey(tenantId: string, key: string): string {
  return `t:${tenantId}:${key}`;
}

export function isTenantSettingKey(key: string, tenantId: string): boolean {
  return key.startsWith(`t:${tenantId}:`);
}

export function parseTenantSettingKey(key: string, tenantId: string): string | null {
  const prefix = `t:${tenantId}:`;
  if (!key.startsWith(prefix)) return null;
  return key.slice(prefix.length);
}

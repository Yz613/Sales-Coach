import { cache } from "react";
import { AsyncLocalStorage } from "node:async_hooks";
import { assertSecureDeployment, localDevelopmentAllowed, configuredAppOrigin, mfaRequired, sessionHasMfa, verifiedSessionOriginAllowed } from "@/lib/security-policy";
import { redirect } from "next/navigation";
import { hasClerkPublishableKey, hasClerkServerAuth } from "@/lib/clerk-env";
import { resolveUserRole, type UserRole } from "@/lib/roles";
import { planFromClerkHas, hostedBillingRequired, type ClerkHas } from "@/lib/billingAccess";
import type { HostedPlanId } from "@/lib/billing";
import { LOCAL_TENANT_ID, runWithTenant } from "@/lib/tenant";
import { toAppPath, stripAppBasePath } from "@/lib/public-path";

export type { UserRole } from "@/lib/roles";

export interface AuthUser {
  userId: string | null;
  role: UserRole;
  isAdmin: boolean;
  isMember: boolean;
  isClerkConfigured: boolean;
  orgId?: string | null;
  orgRole?: string | null;
  hasOrgAdmin?: boolean;
  canViewAllCalls: boolean;
  email?: string;
  name?: string;
  tenantId: string | null;
  clerkPlanId: HostedPlanId | null;
  billingPaid: boolean;
  mfaVerified?: boolean;
  authenticationIssue?: "invalid-origin" | "unavailable";
}

export function isClerkConfigured(): boolean {
  return hasClerkPublishableKey();
}

export function publicGuestAuth(): AuthUser {
  const standalone = localDevelopmentAllowed();
  const role = standalone ? "admin" : "member";
  return {
    userId: null, role, isAdmin: standalone, isMember: !standalone,
    isClerkConfigured: !standalone, canViewAllCalls: standalone,
    tenantId: standalone ? LOCAL_TENANT_ID : null, clerkPlanId: null, billingPaid: standalone,
  };
}

let backfillStarted = false;
async function maybeBackfillLegacyTenant(): Promise<void> {
  const target = process.env.LEGACY_TENANT_ORG_ID?.trim();
  if (backfillStarted || !target || !hasClerkServerAuth()) return;
  backfillStarted = true;
  try {
    const { backfillLegacyTenant } = await import("@/lib/db/service");
    await backfillLegacyTenant(target);
  } catch {
    console.warn("Legacy tenant migration failed; inspect deployment configuration.");
    backfillStarted = false;
  }
}

const authenticatedScope = new AsyncLocalStorage<AuthUser>();
export function runWithAuth<T>(auth: AuthUser, fn: () => T): T {
  return authenticatedScope.run(auth, fn);
}

function isNextControlFlowError(err: unknown): boolean {
  if (!err || typeof err !== "object" || !("digest" in err)) return false;
  const digest = String((err as { digest?: unknown }).digest || "");
  return digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND");
}

/**
 * Get the current user and their role on the server.
 * Reads privileges from the verified active organization membership.
 * Deduped within one request so the layout and the page do not each call Clerk.
 */
const cachedServerAuth = cache(readServerAuth);
export function getServerAuth(): Promise<AuthUser> {
  const scoped = authenticatedScope.getStore();
  return scoped ? Promise.resolve(scoped) : cachedServerAuth();
}

/** Re-read billing after a checkout claim. Must not reuse the request cache. */
export function rereadServerAuth(): Promise<AuthUser> {
  return readServerAuth();
}

async function readServerAuth(): Promise<AuthUser> {
  try {
    return await loadServerAuth();
  } catch (err) {
    if (isNextControlFlowError(err)) throw err;
    console.warn("Verified authentication is unavailable.");
    return { ...publicGuestAuth(), authenticationIssue: "unavailable" };
  }
}

/** Where to send a browser session that is not allowed into the app yet. */
export function authRedirectPath(auth: AuthUser): string | null {
  if (auth.authenticationIssue) return toAppPath("/session-recovery");
  if ((hostedBillingRequired() || !localDevelopmentAllowed()) && !hasClerkServerAuth()) {
    return toAppPath("/sign-in");
  }
  if (auth.isClerkConfigured && !auth.userId) {
    return toAppPath("/sign-in");
  }
  if (auth.isClerkConfigured && !auth.orgId) {
    return toAppPath("/select-organization");
  }
  if (auth.userId && mfaRequired() && !auth.mfaVerified) return toAppPath("/user?security=mfa");
  if (hostedBillingRequired() && auth.isClerkConfigured && !auth.billingPaid) {
    return toAppPath("/subscribe");
  }
  return null;
}

async function loadServerAuth(): Promise<AuthUser> {
  if (localDevelopmentAllowed()) return publicGuestAuth();
  assertSecureDeployment();
  if (!hasClerkServerAuth()) return publicGuestAuth();

  // Authenticate through Clerk's verified server session on every request.
  // Client-supplied x-sc-* headers and personal metadata never establish identity or privileges.
  const { auth, currentUser } = await import("@clerk/nextjs/server");
  const session = await auth();
  const { userId, orgId, orgRole } = session;
  const origin = configuredAppOrigin();
  if (process.env.NODE_ENV === "production" && session.userId && !verifiedSessionOriginAllowed(session.sessionClaims, origin)) {
    return { ...publicGuestAuth(), authenticationIssue: "invalid-origin" };
  }
  const mfaVerified = sessionHasMfa(session.sessionClaims);
  const hasOrgAdmin = Boolean(userId && orgId && session.has({ role: "org:admin" }));
  const clerkHas: ClerkHas = session.has.bind(session);
  let clerkPlanId = planFromClerkHas(clerkHas);
  let email: string | undefined;
  let name: string | undefined;
  if (userId) {
    const user = await currentUser();
    if (user?.id !== userId) return { ...publicGuestAuth(), authenticationIssue: "unavailable" };
    if (user.primaryEmailAddress?.verification?.status === "verified") {
      email = user.primaryEmailAddress.emailAddress;
    }
    name = user.fullName || undefined;
  }
  const role = resolveUserRole({ clerkConfigured: true, userId, orgRole, hasOrgAdmin });
  const tenantId = userId && orgId && orgId !== LOCAL_TENANT_ID && orgId !== "workspace" ? orgId : null;
  let billingPaid = false;
  if (tenantId) {
    await runWithTenant(tenantId, async () => {
      const { ensureD1Migrated } = await import("@/lib/db");
      await ensureD1Migrated();
      await maybeBackfillLegacyTenant();
      try {
        const { loadBillingAccount } = await import("@/lib/billingQuota");
        let account = await loadBillingAccount({ isClerkConfigured: true, orgId, clerkPlanId }, clerkHas);
        if (!account.paid && hostedBillingRequired() && hasOrgAdmin && email && (!mfaRequired() || mfaVerified)) {
          const { claimPendingCheckout } = await import("@/lib/stripeCheckout");
          const claimed = await claimPendingCheckout({ orgId: tenantId, email });
          if (claimed) {
            clerkPlanId = clerkPlanId || claimed;
            account = await loadBillingAccount({ isClerkConfigured: true, orgId, clerkPlanId }, clerkHas);
          }
        }
        billingPaid = account.paid;
      } catch { console.warn("Billing authorization is unavailable."); }
    });
  }
  return {
    userId, email, name, orgId, orgRole, hasOrgAdmin, role,
    isAdmin: role === "admin", isMember: role === "member", isClerkConfigured: true,
    canViewAllCalls: Boolean(userId && tenantId && role === "admin"),
    tenantId, clerkPlanId, billingPaid, mfaVerified,
  };
}

export async function requireAdmin(): Promise<AuthUser> {
  const auth = await getServerAuth();
  const dest = authRedirectPath(auth);
  if (dest) {
    redirect(stripAppBasePath(dest));
  }
  if (!auth.isAdmin) {
    redirect("/calls");
  }
  return auth;
}

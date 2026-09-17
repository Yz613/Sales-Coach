import { redirect } from "next/navigation";
import { hasClerkPublishableKey, hasClerkServerAuth } from "@/lib/clerk-env";
import { resolveCanViewAllCalls } from "@/lib/call-access";
import { resolveUserRole, type UserRole } from "@/lib/roles";
import { planFromClerkHas, hostedBillingRequired, type ClerkHas } from "@/lib/billingAccess";
import type { HostedPlanId } from "@/lib/billing";
import { LOCAL_TENANT_ID, TenantRequiredError, bindTenant } from "@/lib/tenant";
import { toAppPath } from "@/lib/public-path";

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
}

export function isClerkConfigured(): boolean {
  return hasClerkPublishableKey();
}

export function publicGuestAuth(): AuthUser {
  const clerkConfigured = isClerkConfigured();
  const hosted = hostedBillingRequired();
  const standalone = !hosted && !hasClerkServerAuth();
  const role = resolveUserRole({
    clerkConfigured,
    userId: null,
  });
  if (standalone) {
    bindTenant(LOCAL_TENANT_ID);
  }
  return {
    userId: null,
    role,
    isAdmin: role === "admin",
    isMember: role === "member",
    isClerkConfigured: clerkConfigured,
    canViewAllCalls: resolveCanViewAllCalls({
      clerkConfigured,
      userId: null,
      orgRole: undefined,
      hasOrgAdmin: false,
      isAdmin: role === "admin",
    }),
    tenantId: standalone ? LOCAL_TENANT_ID : null,
    clerkPlanId: null,
    billingPaid: standalone,
  };
}

let backfillStarted = false;

async function maybeBackfillLegacyTenant(): Promise<void> {
  if (backfillStarted || !hasClerkServerAuth()) return;
  backfillStarted = true;
  try {
    const { createClerkClient } = await import("@clerk/nextjs/server");
    const { backfillLegacyTenant } = await import("@/lib/db/service");
    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    const list = await clerk.organizations.getOrganizationList({ limit: 100 });
    const orgs = [...(list.data || [])].sort((a, b) => a.createdAt - b.createdAt);
    const oldest = orgs[0]?.id || process.env.LEGACY_TENANT_ORG_ID || null;
    if (oldest) await backfillLegacyTenant(oldest);
  } catch (err) {
    console.warn("Legacy tenant backfill could not list organizations:", err);
    backfillStarted = false;
  }
}

function isNextControlFlowError(err: unknown): boolean {
  if (!err || typeof err !== "object" || !("digest" in err)) return false;
  const digest = String((err as { digest?: unknown }).digest || "");
  return digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND");
}

/**
 * Get the current user and their role on the server.
 * Reads role from the active team, then publicMetadata.role.
 */
export async function getServerAuth(): Promise<AuthUser> {
  try {
    return await loadServerAuth();
  } catch (err) {
    if (isNextControlFlowError(err)) throw err;
    console.warn("getServerAuth failed:", err);
    return publicGuestAuth();
  }
}

/** Where to send a browser session that is not allowed into the app yet. */
export function authRedirectPath(auth: AuthUser): string | null {
  if (hostedBillingRequired() && !hasClerkServerAuth()) {
    return toAppPath("/sign-in");
  }
  if (auth.isClerkConfigured && !auth.userId) {
    return toAppPath("/sign-in");
  }
  if (auth.isClerkConfigured && !auth.orgId) {
    return toAppPath("/select-organization");
  }
  if (hostedBillingRequired() && auth.isClerkConfigured && !auth.billingPaid) {
    return toAppPath("/subscribe");
  }
  return null;
}

async function loadServerAuth(): Promise<AuthUser> {
  const clerkConfigured = isClerkConfigured();

  let userId: string | null = null;
  let email: string | undefined;
  let name: string | undefined;
  let orgId: string | null | undefined;
  let orgRole: string | null | undefined;
  let hasOrgAdmin = false;
  let metadataRole: string | undefined;
  let clerkHas: ClerkHas = undefined;
  let clerkPlanId: HostedPlanId | null = null;

  // Only call auth() when clerkMiddleware will also run. An inlined
  // publishable key alone makes Clerk throw "can't detect clerkMiddleware".
  if (hasClerkServerAuth()) {
    try {
      const { auth, currentUser } = await import("@clerk/nextjs/server");
      const authData = await auth();
      userId = authData.userId;
      orgId = authData.orgId;
      orgRole = authData.orgRole;
      clerkHas = typeof authData.has === "function" ? authData.has.bind(authData) : undefined;
      hasOrgAdmin =
        (typeof authData.has === "function" && authData.has({ role: "org:admin" })) ||
        authData.orgRole === "org:admin";
      clerkPlanId = planFromClerkHas(clerkHas);

      if (userId) {
        const user = await currentUser();
        if (user) {
          email =
            user.primaryEmailAddress?.emailAddress ||
            user.emailAddresses?.[0]?.emailAddress;
          name = user.fullName || (user.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : undefined);
          metadataRole = (user.publicMetadata as Record<string, unknown>)?.role as string | undefined;
        }
      }
    } catch (err) {
      console.warn("Clerk server auth check warning:", err);
    }
  }

  const effectiveRole = resolveUserRole({
    orgRole,
    hasOrgAdmin,
    metadataRole,
    clerkConfigured,
    userId,
  });

  const isAdmin = effectiveRole === "admin";
  const hosted = hostedBillingRequired();
  const standalone = !hosted && !hasClerkServerAuth();
  let tenantId: string | null = null;
  if (standalone) {
    tenantId = LOCAL_TENANT_ID;
    bindTenant(LOCAL_TENANT_ID);
  } else if (orgId && hasClerkServerAuth()) {
    tenantId = orgId;
    bindTenant(orgId);
    try {
      const { ensureD1Migrated } = await import("@/lib/db");
      await ensureD1Migrated();
    } catch {
      // SQLite, build, or a Worker without D1 — billing still loads through getDb().
    }
    await maybeBackfillLegacyTenant();
  }

  let billingPaid = standalone;
  if (tenantId && clerkConfigured && hasClerkServerAuth()) {
    try {
      if (hostedBillingRequired() && !clerkPlanId) {
        const { claimPendingCheckout } = await import("@/lib/stripeCheckout");
        await claimPendingCheckout({ orgId: tenantId, email });
      }
      const { loadBillingAccount } = await import("@/lib/billingQuota");
      const account = await loadBillingAccount(
        { isClerkConfigured: true, orgId, clerkPlanId },
        clerkHas
      );
      billingPaid = account.paid;
    } catch (err) {
      if (err instanceof TenantRequiredError) {
        billingPaid = false;
      } else {
        console.warn("Billing account load warning:", err);
        billingPaid = Boolean(clerkPlanId);
      }
    }
  }

  return {
    userId,
    email,
    name,
    orgId,
    orgRole,
    hasOrgAdmin,
    canViewAllCalls: resolveCanViewAllCalls({
      clerkConfigured,
      userId,
      orgRole,
      hasOrgAdmin,
      isAdmin,
    }),
    role: effectiveRole,
    isAdmin,
    isMember: effectiveRole === "member",
    isClerkConfigured: clerkConfigured,
    tenantId,
    clerkPlanId,
    billingPaid,
  };
}

export async function requireAdmin(): Promise<AuthUser> {
  const auth = await getServerAuth();
  const dest = authRedirectPath(auth);
  if (dest) {
    redirect(dest);
  }
  if (!auth.isAdmin) {
    redirect("/calls");
  }
  return auth;
}

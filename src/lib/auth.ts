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

/**
 * Get the current user and their role on the server.
 * Reads role from the active team, then publicMetadata.role.
 */
export async function getServerAuth(): Promise<AuthUser> {
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
  let tenantId: string | null = null;
  if (!clerkConfigured || !hasClerkServerAuth()) {
    tenantId = LOCAL_TENANT_ID;
    bindTenant(LOCAL_TENANT_ID);
  } else if (orgId) {
    tenantId = orgId;
    bindTenant(orgId);
    await maybeBackfillLegacyTenant();
  }

  let billingPaid = !clerkConfigured || !hasClerkServerAuth();
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
  if (auth.isClerkConfigured && !auth.orgId) {
    redirect(toAppPath("/select-organization"));
  }
  if (hostedBillingRequired() && auth.isClerkConfigured && !auth.billingPaid) {
    redirect(toAppPath("/subscribe"));
  }
  if (!auth.isAdmin) {
    redirect("/calls");
  }
  return auth;
}

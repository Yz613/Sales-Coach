import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hasClerkPublishableKey, hasClerkServerAuth } from "@/lib/clerk-env";
import { resolveCanViewAllCalls } from "@/lib/call-access";
import { resolveUserRole, type UserRole } from "@/lib/roles";

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
}

export function isClerkConfigured(): boolean {
  return hasClerkPublishableKey();
}

/**
 * Get the current user and their role on the server.
 * Reads role from the active Clerk organization, then publicMetadata.role,
 * with support for the dev preview role cookie ("sc_role").
 */
export async function getServerAuth(): Promise<AuthUser> {
  const clerkConfigured = isClerkConfigured();
  const cookieStore = await cookies();
  const cookieRole = cookieStore.get("sc_role")?.value as UserRole | undefined;

  let userId: string | null = null;
  let email: string | undefined;
  let name: string | undefined;
  let orgId: string | null | undefined;
  let orgRole: string | null | undefined;
  let hasOrgAdmin = false;
  let metadataRole: string | undefined;

  // Only call auth() when clerkMiddleware will also run. An inlined
  // publishable key alone makes Clerk throw "can't detect clerkMiddleware".
  if (hasClerkServerAuth()) {
    try {
      const { auth, currentUser } = await import("@clerk/nextjs/server");
      const authData = await auth();
      userId = authData.userId;
      orgId = authData.orgId;
      orgRole = authData.orgRole;
      hasOrgAdmin =
        (typeof authData.has === "function" && authData.has({ role: "org:admin" })) ||
        authData.orgRole === "org:admin";

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
    cookieRole,
    orgRole,
    hasOrgAdmin,
    metadataRole,
    clerkConfigured,
    userId,
  });

  const isAdmin = effectiveRole === "admin";
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
  };
}

export async function requireAdmin(): Promise<AuthUser> {
  const auth = await getServerAuth();
  if (!auth.isAdmin) {
    redirect("/calls");
  }
  return auth;
}

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type UserRole = "admin" | "member";

export interface AuthUser {
  userId: string | null;
  role: UserRole;
  isAdmin: boolean;
  isMember: boolean;
  isClerkConfigured: boolean;
  email?: string;
  name?: string;
}

/**
 * Check whether Clerk environment keys are present.
 */
export function isClerkConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.trim() !== ""
  );
}

/**
 * Get the current user and their role on the server.
 * Reads role from Clerk session metadata (publicMetadata.role or orgRole)
 * with support for dev preview role cookie ("sc_role").
 */
export async function getServerAuth(): Promise<AuthUser> {
  const clerkConfigured = isClerkConfigured();
  const cookieStore = await cookies();
  const cookieRole = cookieStore.get("sc_role")?.value as UserRole | undefined;

  let userId: string | null = null;
  let email: string | undefined;
  let name: string | undefined;
  let clerkRole: UserRole | undefined;

  if (clerkConfigured) {
    try {
      const { auth, currentUser } = await import("@clerk/nextjs/server");
      const authData = await auth();
      userId = authData.userId;

      if (userId) {
        const user = await currentUser();
        if (user) {
          email = user.emailAddresses?.[0]?.emailAddress;
          name = user.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : undefined;
          
          // Role from publicMetadata or organization role
          const metadataRole = (user.publicMetadata as Record<string, unknown>)?.role as string | undefined;
          if (metadataRole === "admin" || metadataRole === "member") {
            clerkRole = metadataRole;
          } else if (authData.orgRole === "org:admin") {
            clerkRole = "admin";
          } else if (authData.orgRole === "org:member") {
            clerkRole = "member";
          }
        }
      }
    } catch (err) {
      console.warn("Clerk server auth check warning:", err);
    }
  }

  // Active role hierarchy:
  // 1. Cookie override (allows testing/switching between Admin and Member views)
  // 2. Clerk metadata role (admin or member)
  // 3. Default: "admin" in development / single-user setup, or "member" if authenticated without admin metadata
  let effectiveRole: UserRole = "admin";
  if (cookieRole === "admin" || cookieRole === "member") {
    effectiveRole = cookieRole;
  } else if (clerkRole) {
    effectiveRole = clerkRole;
  } else if (clerkConfigured && userId) {
    // If Clerk is active and user is signed in but has no explicit role set, default to member
    effectiveRole = "member";
  }

  return {
    userId,
    email,
    name,
    role: effectiveRole,
    isAdmin: effectiveRole === "admin",
    isMember: effectiveRole === "member",
    isClerkConfigured: clerkConfigured,
  };
}

/**
 * Server guard: Enforces that the visitor is an Admin.
 * If user is a Member, immediately redirects to /calls.
 */
export async function requireAdmin(): Promise<AuthUser> {
  const auth = await getServerAuth();
  if (!auth.isAdmin) {
    redirect("/calls");
  }
  return auth;
}

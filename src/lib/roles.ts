export type UserRole = "admin" | "member";

export interface ResolveUserRoleInput {
  cookieRole?: string | null;
  orgRole?: string | null;
  hasOrgAdmin?: boolean;
  metadataRole?: string | null;
  clerkConfigured: boolean;
  userId?: string | null;
}

/**
 * Resolve the app-level Admin/Member role.
 *
 * Roles are not user-switchable. Priority:
 * 1. Active team role (`org:admin` → admin, `org:member` → member)
 * 2. All other Clerk sessions default to member
 * 3. Local development defaults to admin (production is gated separately)
 *
 * A leftover `sc_role` cookie is ignored so members cannot elevate themselves.
 */
export function resolveUserRole(input: ResolveUserRoleInput): UserRole {
  void input.cookieRole;

  if (!input.clerkConfigured) return "admin";
  if (input.userId && (input.hasOrgAdmin || input.orgRole === "org:admin")) {
    return "admin";
  }

  if (input.orgRole === "org:member") {
    return "member";
  }

  // Personal profile metadata cannot grant privileges in an organization.
  return "member";
}

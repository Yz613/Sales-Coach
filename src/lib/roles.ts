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
 * 2. User publicMetadata.role
 * 3. Signed-in user defaults to member; local/no-auth defaults to admin
 *
 * A leftover `sc_role` cookie is ignored so members cannot elevate themselves.
 */
export function resolveUserRole(input: ResolveUserRoleInput): UserRole {
  void input.cookieRole;

  if (input.hasOrgAdmin || input.orgRole === "org:admin") {
    return "admin";
  }

  if (input.orgRole === "org:member") {
    return "member";
  }

  if (input.metadataRole === "admin" || input.metadataRole === "member") {
    return input.metadataRole;
  }

  if (input.clerkConfigured && input.userId) {
    return "member";
  }

  return "admin";
}

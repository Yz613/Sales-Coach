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
 * Priority:
 * 1. `sc_role` cookie (preview / local emulator)
 * 2. Active Clerk organization role (`org:admin` → admin)
 * 3. Clerk user publicMetadata.role
 * 4. Signed-in Clerk user defaults to member; otherwise admin (local/no-auth)
 */
export function resolveUserRole(input: ResolveUserRoleInput): UserRole {
  if (input.cookieRole === "admin" || input.cookieRole === "member") {
    return input.cookieRole;
  }

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

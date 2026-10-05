import { resolveUserRole, type UserRole } from "./roles";

/**
 * Client role for the sidebar and other client gates.
 *
 * The root layout does not re-render on client navigations, so the role it
 * passed from a public page (member) stays stale after sign-in or team
 * selection. The live Clerk organization membership is the source of truth
 * once it is known. A later server role prop still applies when that
 * membership has not itself changed.
 */
export interface ClerkMembershipInput {
  authLoaded: boolean;
  orgLoaded: boolean;
  userId?: string | null;
  orgRole?: string | null;
  hasOrgAdmin?: boolean;
}

export interface ClientRoleEvent {
  initialRole: UserRole;
  /** False when the layout used the public-page guest role. */
  trustServerRole: boolean;
  clerkConfigured: boolean;
  /** `useAuth().isLoaded` — false while Clerk boots or switches organizations. */
  authLoaded: boolean;
  /** `useOrganization().isLoaded`. */
  orgLoaded: boolean;
  userId?: string | null;
  orgRole?: string | null;
  hasOrgAdmin?: boolean;
}

export interface ClientRoleMemory {
  role: UserRole;
  prevInitialRole: UserRole;
  prevTrustServerRole: boolean;
  prevClerkRole: UserRole | null;
}

export interface ClientRoleReduction {
  memory: ClientRoleMemory;
  role: UserRole;
  isLoading: boolean;
}

export function initialClientRoleMemory(
  initialRole: UserRole,
  trustServerRole: boolean
): ClientRoleMemory {
  return {
    role: initialRole,
    prevInitialRole: initialRole,
    prevTrustServerRole: trustServerRole,
    prevClerkRole: null,
  };
}

/** Prefer the active organization membership role, then the session org role. */
export function clerkOrgRole(input: {
  authOrgRole?: string | null;
  orgLoaded: boolean;
  membershipRole?: string | null;
}): string | null {
  if (input.orgLoaded && input.membershipRole) return input.membershipRole;
  return input.authOrgRole || null;
}

function membershipReady(event: ClientRoleEvent): boolean {
  if (!event.clerkConfigured || !event.authLoaded) return false;
  if (!event.userId) return true;
  if (event.orgRole || event.hasOrgAdmin) return true;
  return event.orgLoaded;
}

export function reduceClientRole(
  memory: ClientRoleMemory,
  event: ClientRoleEvent
): ClientRoleReduction {
  const ready = membershipReady(event);
  const clerkRole = ready
    ? resolveUserRole({
        clerkConfigured: true,
        userId: event.userId,
        orgRole: event.orgRole,
        hasOrgAdmin: Boolean(event.hasOrgAdmin),
      })
    : null;

  const hadClerkRole = memory.prevClerkRole !== null;
  let role = memory.role;
  let prevInitialRole = memory.prevInitialRole;
  let prevTrustServerRole = memory.prevTrustServerRole;
  let prevClerkRole = memory.prevClerkRole;

  if (clerkRole && clerkRole !== prevClerkRole) {
    prevClerkRole = clerkRole;
    role = clerkRole;
  } else if (
    event.initialRole !== prevInitialRole ||
    event.trustServerRole !== prevTrustServerRole
  ) {
    // Public-page guest defaults must not overwrite a Clerk membership.
    if (event.trustServerRole) role = event.initialRole;
    prevInitialRole = event.initialRole;
    prevTrustServerRole = event.trustServerRole;
  }

  // Hide the member nav until Clerk reports the membership. A server-rendered
  // admin can paint immediately. After a membership was known, an org switch
  // (auth not loaded) stays in loading so the previous menu does not flash.
  const isLoading =
    event.clerkConfigured && !ready && (hadClerkRole || role !== "admin");

  return {
    memory: { role, prevInitialRole, prevTrustServerRole, prevClerkRole },
    role,
    isLoading,
  };
}

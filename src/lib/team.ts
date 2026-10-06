import { clerkClient } from "@clerk/nextjs/server";
import { parseInviteEmails } from "@/lib/inviteEmails";
import { publicTeamError, type PendingInvite, type TeamInfo, type TeamInviteRole } from "@/lib/team-copy";
import { SecurityPolicyError } from "@/lib/security-policy";
import { ensureTeamSeatLimits, UNLIMITED_TEAM_SEATS } from "@/lib/teamCapacity";
import { notifyWorkspaceCreated } from "@/lib/visitorFollowUp";

export type { TeamInviteRole, TeamInfo, PendingInvite } from "@/lib/team-copy";
export { parseInviteRole, publicTeamError } from "@/lib/team-copy";

function membershipToTeam(membership: {
  role: string;
  organization: { id: string; name: string };
}): TeamInfo {
  return {
    id: membership.organization.id,
    name: membership.organization.name,
    role: membership.role,
  };
}

export async function ensureActiveTeam(
  userId: string,
  targetOrgId?: string | null,
  providedClient?: Awaited<ReturnType<typeof clerkClient>>
): Promise<TeamInfo> {
  const client = providedClient ?? await clerkClient();
  const limit = 100;
  for (let offset = 0; ; offset += limit) {
    const existing = await client.users.getOrganizationMembershipList({ userId, limit, offset });
    const match = targetOrgId
      ? existing.data.find((membership) => membership.organization.id === targetOrgId)
      : existing.data[0];
    if (match) return membershipToTeam(match);
    if (existing.data.length < limit) break;
  }
  // An explicitly selected workspace must never provision or restore privileges elsewhere.
  if (targetOrgId) throw new SecurityPolicyError("You are not a member of this team.", 403, "FORBIDDEN");

  const user = await client.users.getUser(userId);
  const name = user.firstName ? `${user.firstName}'s team` : "Team";
  const created = await client.organizations.createOrganization({
    name,
    createdBy: userId,
    maxAllowedMemberships: UNLIMITED_TEAM_SEATS,
  });
  try {
    notifyWorkspaceCreated(clerkUserEmail(user));
  } catch (err) {
    console.error("visitor follow-up workspace conversion failed", err instanceof Error ? err.name : "Error");
  }
  return { id: created.id, name: created.name, role: "org:admin" };
}

function clerkUserEmail(user: {
  primaryEmailAddress?: { emailAddress?: string | null } | null;
  emailAddresses?: { emailAddress?: string | null }[];
}): string | null {
  return user.primaryEmailAddress?.emailAddress || user.emailAddresses?.find((entry) => entry.emailAddress)?.emailAddress || null;
}

export async function listPendingInvites(organizationId: string): Promise<PendingInvite[]> {
  const client = await clerkClient();
  const invitations = await client.organizations.getOrganizationInvitationList({
    organizationId,
    status: ["pending"],
    limit: 50,
  });
  return invitations.data.map((invitation) => ({
    id: invitation.id,
    emailAddress: invitation.emailAddress,
    role: invitation.role,
  }));
}

// Teammate invite addresses are not visitor follow-up leads.
export async function sendTeamInvites(input: {
  organizationId: string;
  userId: string;
  emails: string[];
  role: TeamInviteRole;
}): Promise<{ sent: string[]; failed: { email: string; reason: string }[] }> {
  const client = await clerkClient();
  await ensureTeamSeatLimits(client, input.organizationId);
  const emails = parseInviteEmails(input.emails.join("\n"));
  const sent: string[] = [];
  const failed: { email: string; reason: string }[] = [];

  for (const email of emails) {
    try {
      await client.organizations.createOrganizationInvitation({
        organizationId: input.organizationId,
        emailAddress: email,
        role: input.role,
        inviterUserId: input.userId,
      });
      sent.push(email);
    } catch (err) {
      failed.push({ email, reason: publicTeamError(err) });
    }
  }

  return { sent, failed };
}

export async function revokeTeamInvite(input: {
  organizationId: string;
  invitationId: string;
  userId: string;
}): Promise<void> {
  const client = await clerkClient();
  await client.organizations.revokeOrganizationInvitation({
    organizationId: input.organizationId,
    invitationId: input.invitationId,
    requestingUserId: input.userId,
  });
}

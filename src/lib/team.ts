import { clerkClient } from "@clerk/nextjs/server";
import { parseInviteEmails } from "@/lib/inviteEmails";
import { publicTeamError, type PendingInvite, type TeamInfo, type TeamInviteRole } from "@/lib/team-copy";
import { ensureTeamSeatLimits, UNLIMITED_TEAM_SEATS } from "@/lib/teamCapacity";

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

export async function ensureActiveTeam(userId: string, targetOrgId?: string): Promise<TeamInfo> {
  const client = await clerkClient();
  const existing = await client.users.getOrganizationMembershipList({
    userId,
    limit: 20,
  });
  if (targetOrgId) {
    const match = existing.data.find((m) => m.organization.id === targetOrgId);
    if (match) {
      return membershipToTeam(match);
    }
  } else if (existing.data.length > 0) {
    return membershipToTeam(existing.data[0]);
  }

  const orgs = await client.organizations.getOrganizationList({
    limit: 20,
    includeMembersCount: true,
  });
  const owned = targetOrgId
    ? orgs.data.find((org) => org.id === targetOrgId && org.createdBy === userId)
    : orgs.data.find((org) => org.createdBy === userId);

  if (owned) {
    try {
      await ensureTeamSeatLimits(client, owned.id);
      const membership = await client.organizations.createOrganizationMembership({
        organizationId: owned.id,
        userId,
        role: "org:admin",
      });
      return membershipToTeam(membership);
    } catch (err) {
      const retry = await client.users.getOrganizationMembershipList({
        userId,
        limit: 20,
      });
      const retryMatch = targetOrgId
        ? retry.data.find((m) => m.organization.id === targetOrgId)
        : retry.data[0];
      if (retryMatch) {
        return membershipToTeam(retryMatch);
      }
      throw err;
    }
  }

  const user = await client.users.getUser(userId);
  const name = user.firstName ? `${user.firstName}'s team` : "Team";
  const created = await client.organizations.createOrganization({
    name,
    createdBy: userId,
    maxAllowedMemberships: UNLIMITED_TEAM_SEATS,
  });
  return { id: created.id, name: created.name, role: "org:admin" };
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

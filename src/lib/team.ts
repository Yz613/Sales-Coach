import { clerkClient } from "@clerk/nextjs/server";
import { parseInviteEmails } from "@/lib/inviteEmails";
import { publicTeamError, type PendingInvite, type TeamInfo, type TeamInviteRole } from "@/lib/team-copy";

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

export async function ensureActiveTeam(userId: string): Promise<TeamInfo> {
  const client = await clerkClient();
  const existing = await client.users.getOrganizationMembershipList({
    userId,
    limit: 20,
  });
  if (existing.data.length > 0) {
    return membershipToTeam(existing.data[0]);
  }

  const orgs = await client.organizations.getOrganizationList({
    limit: 20,
    includeMembersCount: true,
  });
  const owned = orgs.data.find((org) => org.createdBy === userId);
  const target = owned ?? orgs.data[0];

  if (target) {
    try {
      const membership = await client.organizations.createOrganizationMembership({
        organizationId: target.id,
        userId,
        role: "org:admin",
      });
      return membershipToTeam(membership);
    } catch (err) {
      const retry = await client.users.getOrganizationMembershipList({
        userId,
        limit: 20,
      });
      if (retry.data.length > 0) {
        return membershipToTeam(retry.data[0]);
      }
      throw err;
    }
  }

  const user = await client.users.getUser(userId);
  const name = user.firstName ? `${user.firstName}'s team` : "Team";
  const created = await client.organizations.createOrganization({
    name,
    createdBy: userId,
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

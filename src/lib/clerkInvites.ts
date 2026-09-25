import { clerkClient } from "@clerk/nextjs/server";
import type { ClerkInvitation, ClerkInviteApi } from "./inviteSend";
import type { InviteRole } from "./inviteEmails";
import { ensureTeamSeatLimits } from "./teamCapacity";
import { memberDisplayName, sortTeamMembers, type TeamMember } from "./teamRoster";

function asInvitation(row: {
  id: string;
  emailAddress: string;
  role: string;
  url?: string | null;
  createdAt: number;
}): ClerkInvitation {
  return {
    id: row.id,
    emailAddress: row.emailAddress,
    role: row.role,
    url: row.url ?? null,
    createdAt: row.createdAt,
  };
}

export async function createClerkInviteApi(): Promise<ClerkInviteApi> {
  const clerk = await clerkClient();
  return {
    async listPending(organizationId) {
      const { data } = await clerk.organizations.getOrganizationInvitationList({
        organizationId,
        status: ["pending"],
        limit: 100,
      });
      return Promise.all(
        data.map(async (row) => {
          if (row.url) return asInvitation(row);
          try {
            const full = await clerk.organizations.getOrganizationInvitation({
              organizationId,
              invitationId: row.id,
            });
            return asInvitation(full);
          } catch {
            return asInvitation(row);
          }
        })
      );
    },
    async create(params) {
      await ensureTeamSeatLimits(clerk, params.organizationId);
      const created = await clerk.organizations.createOrganizationInvitation({
        organizationId: params.organizationId,
        inviterUserId: params.inviterUserId,
        emailAddress: params.emailAddress,
        role: params.role,
        redirectUrl: params.redirectUrl,
        notify: params.notify,
      } as {
        organizationId: string;
        inviterUserId: string;
        emailAddress: string;
        role: InviteRole;
        redirectUrl: string;
        notify: boolean;
      });
      return asInvitation(created);
    },
    async revoke(params) {
      await clerk.organizations.revokeOrganizationInvitation({
        organizationId: params.organizationId,
        invitationId: params.invitationId,
        requestingUserId: params.requestingUserId,
      });
    },
  };
}

export async function listTeamMembers(organizationId: string): Promise<TeamMember[]> {
  const clerk = await clerkClient();
  const { data } = await clerk.organizations.getOrganizationMembershipList({
    organizationId,
    limit: 100,
  });
  const members = data.flatMap((membership) => {
    const user = membership.publicUserData;
    if (!user?.userId) return [];
    const email = user.identifier || "";
    return [
      {
        userId: user.userId,
        email,
        name: memberDisplayName({ firstName: user.firstName, lastName: user.lastName, email }),
        role: membership.role,
      },
    ];
  });
  return sortTeamMembers(members);
}

export async function updateTeamMemberRole(input: {
  organizationId: string;
  userId: string;
  role: InviteRole;
}): Promise<void> {
  const clerk = await clerkClient();
  await clerk.organizations.updateOrganizationMembership({
    organizationId: input.organizationId,
    userId: input.userId,
    role: input.role,
  });
}

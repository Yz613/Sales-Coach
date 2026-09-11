import { clerkClient } from "@clerk/nextjs/server";
import type { ClerkInvitation, ClerkInviteApi } from "./inviteSend";
import type { InviteRole } from "./inviteEmails";

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
      return data.map(asInvitation);
    },
    async create(params) {
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

import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { getSetting } from "@/lib/db/service";
import { createClerkInviteApi, listTeamMembers } from "@/lib/clerkInvites";
import type { ClerkInvitation } from "@/lib/inviteSend";
import type { TeamMember } from "@/lib/teamRoster";
import { requireWorkspace, workspaceErrorResponse } from "@/lib/workspace";

export type InviteAdmin =
  | { ok: false; response: NextResponse }
  | { ok: true; userId: string; orgId: string };

export type InviteRoster = {
  members: TeamMember[];
  invitations: ClerkInvitation[];
  emailConfigured: boolean;
};

export async function requireInviteAdmin(): Promise<InviteAdmin> {
  try {
    const session = await requireWorkspace();
    if (!session.userId || !session.orgId) {
      return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    }
    if (!session.isAdmin) {
      return { ok: false, response: NextResponse.json({ error: "Only team admins can manage invites" }, { status: 403 }) };
    }
    return { ok: true, userId: session.userId, orgId: session.orgId };
  } catch (err) {
    return { ok: false, response: workspaceErrorResponse(err) };
  }
}

export async function resolveResendApiKey(): Promise<string | null> {
  const fromEnv = process.env.RESEND_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  return (await getSetting("resend_api_key"))?.trim() || null;
}

export async function organizationName(orgId: string): Promise<string> {
  try {
    const clerk = await clerkClient();
    const org = await clerk.organizations.getOrganization({ organizationId: orgId });
    return org.name || "your team";
  } catch {
    return "your team";
  }
}

export async function loadInviteRoster(orgId: string): Promise<InviteRoster> {
  const clerk = await createClerkInviteApi();
  const [invitations, members, resendApiKey] = await Promise.all([
    clerk.listPending(orgId),
    listTeamMembers(orgId),
    resolveResendApiKey(),
  ]);
  return { invitations, members, emailConfigured: Boolean(resendApiKey) };
}

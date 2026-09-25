import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { isInviteRole } from "@/lib/inviteEmails";
import { buildInviteRedirectUrl } from "@/lib/inviteRedirect";
import { createClerkInviteApi } from "@/lib/clerkInvites";
import { sendOrganizationInvites } from "@/lib/inviteSend";
import { loadInviteRoster, organizationName, requireInviteAdmin, resolveResendApiKey } from "@/lib/inviteAdmin";

export async function POST(req: NextRequest) {
  const gate = await requireInviteAdmin();
  if (!gate.ok) return gate.response;

  let body: { invitationId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const invitationId = String(body.invitationId || "").trim();
  if (!invitationId) {
    return NextResponse.json({ error: "Missing invitation id" }, { status: 400 });
  }

  const clerk = await createClerkInviteApi();
  const pending = await clerk.listPending(gate.orgId);
  const invitation = pending.find((item) => item.id === invitationId);
  if (!invitation) {
    return NextResponse.json({ error: "That invite is no longer pending." }, { status: 404 });
  }
  if (!isInviteRole(invitation.role)) {
    return NextResponse.json({ error: "This invite uses a role this page can't resend." }, { status: 400 });
  }

  const resendApiKey = await resolveResendApiKey();
  const user = await currentUser();
  const inviterEmail = user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress;
  const results = await sendOrganizationInvites({
    organizationId: gate.orgId,
    organizationName: await organizationName(gate.orgId),
    inviterUserId: gate.userId,
    inviterEmail,
    emails: [invitation.emailAddress],
    role: invitation.role,
    redirectUrl: buildInviteRedirectUrl(req.url),
    clerk,
    resendApiKey,
    fromEmail: process.env.RESEND_FROM_EMAIL,
  });
  const failed = results.find((item) => !item.ok);
  const roster = await loadInviteRoster(gate.orgId);
  if (failed) {
    return NextResponse.json({ error: failed.error || "Could not resend that invite.", ...roster }, { status: 400 });
  }
  return NextResponse.json({ results, ...roster });
}

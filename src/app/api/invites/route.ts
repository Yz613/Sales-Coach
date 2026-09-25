import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { isInviteRole, parseInviteEmails } from "@/lib/inviteEmails";
import { buildInviteRedirectUrl } from "@/lib/inviteRedirect";
import { createClerkInviteApi, listTeamMembers, updateTeamMemberRole } from "@/lib/clerkInvites";
import { clerkErrorMessage, sendOrganizationInvites } from "@/lib/inviteSend";
import {
  loadInviteRoster,
  organizationName,
  requireInviteAdmin,
  resolveResendApiKey,
} from "@/lib/inviteAdmin";
import { memberRoleChangeError } from "@/lib/teamRoster";

export async function GET() {
  const gate = await requireInviteAdmin();
  if (!gate.ok) return gate.response;
  return NextResponse.json(await loadInviteRoster(gate.orgId));
}

export async function POST(req: NextRequest) {
  const gate = await requireInviteAdmin();
  if (!gate.ok) return gate.response;

  let body: { emails?: unknown; emailText?: unknown; role?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const emails = Array.isArray(body.emails)
    ? body.emails.map((item) => String(item)).flatMap((item) => parseInviteEmails(item))
    : parseInviteEmails(String(body.emailText || ""));
  if (emails.length === 0) {
    return NextResponse.json({ error: "Enter one or more email addresses." }, { status: 400 });
  }
  if (!isInviteRole(body.role)) {
    return NextResponse.json({ error: "Choose Member or Admin." }, { status: 400 });
  }

  const resendApiKey = await resolveResendApiKey();
  const clerk = await createClerkInviteApi();
  const user = await currentUser();
  const inviterEmail = user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress;

  const results = await sendOrganizationInvites({
    organizationId: gate.orgId,
    organizationName: await organizationName(gate.orgId),
    inviterUserId: gate.userId,
    inviterEmail,
    emails,
    role: body.role,
    redirectUrl: buildInviteRedirectUrl(req.url),
    clerk,
    resendApiKey,
    fromEmail: process.env.RESEND_FROM_EMAIL,
  });

  return NextResponse.json({
    results,
    ...(await loadInviteRoster(gate.orgId)),
  });
}

export async function PATCH(req: NextRequest) {
  const gate = await requireInviteAdmin();
  if (!gate.ok) return gate.response;

  let body: { userId?: unknown; invitationId?: unknown; role?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!isInviteRole(body.role)) {
    return NextResponse.json({ error: "Choose Member or Admin." }, { status: 400 });
  }

  const userId = String(body.userId || "").trim();
  const invitationId = String(body.invitationId || "").trim();
  if (!userId && !invitationId) {
    return NextResponse.json({ error: "Choose a teammate or a pending invite." }, { status: 400 });
  }

  if (userId) {
    const members = await listTeamMembers(gate.orgId);
    const blocked = memberRoleChangeError(members, userId, body.role);
    if (blocked) return NextResponse.json({ error: blocked }, { status: 400 });
    try {
      await updateTeamMemberRole({ organizationId: gate.orgId, userId, role: body.role });
    } catch (err) {
      return NextResponse.json({ error: clerkErrorMessage(err, "Could not change that role") }, { status: 400 });
    }
    return NextResponse.json(await loadInviteRoster(gate.orgId));
  }

  const clerk = await createClerkInviteApi();
  const pending = await clerk.listPending(gate.orgId);
  const invitation = pending.find((item) => item.id === invitationId);
  if (!invitation) {
    return NextResponse.json({ error: "That invite is no longer pending." }, { status: 404 });
  }
  if (invitation.role === body.role) {
    return NextResponse.json(await loadInviteRoster(gate.orgId));
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
    role: body.role,
    redirectUrl: buildInviteRedirectUrl(req.url),
    clerk,
    resendApiKey,
    fromEmail: process.env.RESEND_FROM_EMAIL,
  });
  const failed = results.find((item) => !item.ok);
  if (failed) {
    return NextResponse.json(
      { error: failed.error || "Could not change that invite.", ...(await loadInviteRoster(gate.orgId)) },
      { status: 400 }
    );
  }

  return NextResponse.json({
    results,
    ...(await loadInviteRoster(gate.orgId)),
  });
}

export async function DELETE(req: NextRequest) {
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
  await clerk.revoke({
    organizationId: gate.orgId,
    invitationId,
    requestingUserId: gate.userId,
  });
  return NextResponse.json({ ok: true, ...(await loadInviteRoster(gate.orgId)) });
}

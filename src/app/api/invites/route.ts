import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { getSetting } from "@/lib/db/service";
import { isInviteRole, parseInviteEmails } from "@/lib/inviteEmails";
import { buildInviteRedirectUrl } from "@/lib/inviteRedirect";
import { createClerkInviteApi } from "@/lib/clerkInvites";
import { sendOrganizationInvites } from "@/lib/inviteSend";
import { hasClerkServerAuth } from "@/lib/clerk-env";

type AdminGate =
  | { ok: false; response: NextResponse }
  | { ok: true; userId: string; orgId: string };

async function requireOrgAdmin(): Promise<AdminGate> {
  if (!hasClerkServerAuth()) {
    return { ok: false, response: NextResponse.json({ error: "Authentication is not configured" }, { status: 503 }) };
  }
  const authData = await auth();
  if (!authData.userId) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const isAdmin =
    (typeof authData.has === "function" && authData.has({ role: "org:admin" })) ||
    authData.orgRole === "org:admin";
  if (!authData.orgId || !isAdmin) {
    return { ok: false, response: NextResponse.json({ error: "Only team admins can manage invites" }, { status: 403 }) };
  }
  return { ok: true, userId: authData.userId, orgId: authData.orgId };
}

async function resolveResendApiKey(): Promise<string | null> {
  const fromEnv = process.env.RESEND_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  return (await getSetting("resend_api_key"))?.trim() || null;
}

async function organizationName(orgId: string): Promise<string> {
  try {
    const clerk = await clerkClient();
    const org = await clerk.organizations.getOrganization({ organizationId: orgId });
    return org.name || "your team";
  } catch {
    return "your team";
  }
}

export async function GET() {
  const gate = await requireOrgAdmin();
  if (!gate.ok) return gate.response;

  const clerk = await createClerkInviteApi();
  const invitations = await clerk.listPending(gate.orgId);
  return NextResponse.json({
    invitations,
    emailConfigured: Boolean(await resolveResendApiKey()),
  });
}

export async function POST(req: NextRequest) {
  const gate = await requireOrgAdmin();
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

  const invitations = await clerk.listPending(gate.orgId);
  return NextResponse.json({
    results,
    invitations,
    emailConfigured: Boolean(resendApiKey),
  });
}

export async function DELETE(req: NextRequest) {
  const gate = await requireOrgAdmin();
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
  const invitations = await clerk.listPending(gate.orgId);
  return NextResponse.json({ ok: true, invitations, emailConfigured: Boolean(await resolveResendApiKey()) });
}

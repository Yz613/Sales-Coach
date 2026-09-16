import { NextRequest, NextResponse } from "next/server";
import { parseInviteEmails } from "@/lib/inviteEmails";
import { parseInviteRole } from "@/lib/team-copy";
import { ensureActiveTeam, listPendingInvites, publicTeamError, sendTeamInvites } from "@/lib/team";
import { requireWorkspace, workspaceErrorResponse } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let auth;
  try {
    auth = await requireWorkspace();
  } catch (err) {
    return workspaceErrorResponse(err);
  }
  if (!auth.userId) {
    return NextResponse.json({ error: "Sign in first, then you can invite teammates." }, { status: 401 });
  }

  let body: { emails?: unknown; role?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Enter one or more email addresses." }, { status: 400 });
  }

  const rawEmails = Array.isArray(body.emails)
    ? body.emails.map((value) => String(value))
    : [String(body.emails ?? "")];
  const emails = parseInviteEmails(rawEmails.join("\n"));
  if (emails.length === 0) {
    return NextResponse.json({ error: "Enter one or more email addresses." }, { status: 400 });
  }

  try {
    const team = await ensureActiveTeam(auth.userId);
    const result = await sendTeamInvites({
      organizationId: team.id,
      userId: auth.userId,
      emails,
      role: parseInviteRole(body.role),
    });
    const invitations = await listPendingInvites(team.id);
    return NextResponse.json({ team, invitations, ...result });
  } catch (err) {
    return NextResponse.json({ error: publicTeamError(err) }, { status: 500 });
  }
}

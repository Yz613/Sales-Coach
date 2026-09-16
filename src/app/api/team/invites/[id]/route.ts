import { NextRequest, NextResponse } from "next/server";
import { ensureActiveTeam, listPendingInvites, publicTeamError, revokeTeamInvite } from "@/lib/team";
import { requireWorkspace, workspaceErrorResponse } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireWorkspace();
    if (!auth.userId) {
      return NextResponse.json({ error: "Sign in first, then you can invite teammates." }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing invite" }, { status: 400 });
    }

    const team = await ensureActiveTeam(auth.userId);
    await revokeTeamInvite({
      organizationId: team.id,
      invitationId: id,
      userId: auth.userId,
    });
    const invitations = await listPendingInvites(team.id);
    return NextResponse.json({ team, invitations });
  } catch (err) {
    const gated = workspaceErrorResponse(err);
    if (gated.status !== 500) return gated;
    return NextResponse.json({ error: publicTeamError(err) }, { status: 500 });
  }
}

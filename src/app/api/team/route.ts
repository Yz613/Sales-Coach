import { NextResponse } from "next/server";
import { ensureActiveTeam, listPendingInvites, publicTeamError } from "@/lib/team";
import { requireWorkspace, workspaceErrorResponse } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireWorkspace();
    if (!auth.userId) {
      return NextResponse.json({ error: "Sign in first, then you can invite teammates." }, { status: 401 });
    }
    const team = await ensureActiveTeam(auth.userId);
    const invitations = await listPendingInvites(team.id);
    return NextResponse.json({ team, invitations });
  } catch (err) {
    const gated = workspaceErrorResponse(err);
    if (gated.status !== 500) return gated;
    return NextResponse.json({ error: publicTeamError(err) }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/auth";
import { ensureActiveTeam, listPendingInvites, publicTeamError } from "@/lib/team";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getServerAuth();
  if (!auth.userId) {
    return NextResponse.json({ error: "Sign in first, then you can invite teammates." }, { status: 401 });
  }

  try {
    const team = await ensureActiveTeam(auth.userId);
    const invitations = await listPendingInvites(team.id);
    return NextResponse.json({ team, invitations });
  } catch (err) {
    return NextResponse.json({ error: publicTeamError(err) }, { status: 500 });
  }
}

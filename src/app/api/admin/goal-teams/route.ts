import { NextResponse } from "next/server";
import { getAllReps, getCallSummaries, getSetting, setSetting } from "@/lib/db/service";
import { GOAL_TEAMS_SETTING_KEY, buildGoalReps, readGoalTeams, validateGoalTeams } from "@/lib/goalTeams";
import { requireWorkspace, workspaceErrorResponse } from "@/lib/workspace";

async function requireGoalAdmin() {
  const auth = await requireWorkspace();
  if (!auth.isAdmin) throw Object.assign(new Error("Only admins can view and manage team goals."), { status: 403 });
}

export async function GET() {
  try {
    await requireGoalAdmin();
    const [reps, calls, saved] = await Promise.all([getAllReps(), getCallSummaries(), getSetting(GOAL_TEAMS_SETTING_KEY)]);
    return NextResponse.json({ teams: readGoalTeams(saved, reps), reps: buildGoalReps(reps, calls) });
  } catch (err) {
    return workspaceErrorResponse(err);
  }
}

export async function PUT(req: Request) {
  try {
    await requireGoalAdmin();
    const reps = await getAllReps();
    let teams;
    try {
      const body = await req.json();
      teams = validateGoalTeams(body?.teams, reps.map((rep) => rep.id));
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid team goals." }, { status: 400 });
    }
    await setSetting(GOAL_TEAMS_SETTING_KEY, JSON.stringify(teams));
    return NextResponse.json({ teams });
  } catch (err) {
    return workspaceErrorResponse(err);
  }
}

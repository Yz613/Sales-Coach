import { withWorkspaceApi } from "@/lib/workspace";
import { NextResponse } from "next/server";
import { readJson, revenueError } from "@/lib/revenue/api";
import { actorId } from "@/lib/revenue/conversations";
import { listScorecards, saveScorecard } from "@/lib/scorecards";
import { requireWorkspace } from "@/lib/workspace";

async function GETHandler() {
  try {
    return NextResponse.json(await listScorecards());
  } catch (error) {
    return revenueError(error);
  }
}

async function POSTHandler(request: Request) {
  try {
    const auth = await requireWorkspace();
    const body = await readJson(request);
    return NextResponse.json(await saveScorecard(actorId(auth), body));
  } catch (error) {
    return revenueError(error);
  }
}

export const GET = withWorkspaceApi(GETHandler, { admin: true });
export const POST = withWorkspaceApi(POSTHandler, { admin: true });
export const dynamic = "force-dynamic";

import { withWorkspaceApi } from "@/lib/workspace";
import { NextResponse } from "next/server";
import { readJson, revenueError } from "@/lib/revenue/api";
import { actorId } from "@/lib/revenue/conversations";
import { removeScorecard, saveScorecard } from "@/lib/scorecards";
import { requireWorkspace } from "@/lib/workspace";

type Context = { params: Promise<{ id: string }> };

async function PATCHHandler(request: Request, ctx: Context) {
  try {
    const auth = await requireWorkspace();
    const { id } = await ctx.params;
    const body = await readJson(request);
    return NextResponse.json(await saveScorecard(actorId(auth), body, id));
  } catch (error) {
    return revenueError(error);
  }
}

async function DELETEHandler(_request: Request, ctx: Context) {
  try {
    const { id } = await ctx.params;
    return NextResponse.json(await removeScorecard(id));
  } catch (error) {
    return revenueError(error);
  }
}

export const PATCH = withWorkspaceApi(PATCHHandler, { admin: true });
export const DELETE = withWorkspaceApi(DELETEHandler, { admin: true });
export const dynamic = "force-dynamic";

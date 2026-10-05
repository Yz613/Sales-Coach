import { withWorkspaceApi } from "@/lib/workspace";
import { NextResponse } from "next/server";
import { requireConversation } from "@/lib/revenue/access";
import { readJson, revenueError } from "@/lib/revenue/api";
import { RevenueError } from "@/lib/revenue/security";
import { applyScorecardToCall, listCallScorecards, saveCallScorecardAnswer, submitCallScorecard } from "@/lib/scorecards";

type Context = { params: Promise<{ id: string }> };

async function GETHandler(_request: Request, ctx: Context) {
  try {
    const { id } = await ctx.params;
    const { auth } = await requireConversation(id);
    return NextResponse.json(await listCallScorecards(auth, id));
  } catch (error) {
    return revenueError(error);
  }
}

async function POSTHandler(request: Request, ctx: Context) {
  try {
    const { id } = await ctx.params;
    const { auth } = await requireConversation(id);
    const body = await readJson(request);
    if (body.action === "apply") return NextResponse.json(await applyScorecardToCall(auth, id, String(body.templateId || "")));
    if (body.action === "answer") return NextResponse.json(await saveCallScorecardAnswer(auth, id, body));
    if (body.action === "submit") return NextResponse.json(await submitCallScorecard(auth, id, String(body.applicationId || "")));
    throw new RevenueError("Unknown scorecard action.");
  } catch (error) {
    return revenueError(error);
  }
}

export const GET = withWorkspaceApi(GETHandler, {});
export const POST = withWorkspaceApi(POSTHandler, {});
export const dynamic = "force-dynamic";

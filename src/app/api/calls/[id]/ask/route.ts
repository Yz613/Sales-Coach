import { NextResponse } from "next/server";
import { withWorkspaceApi, requireWorkspace } from "@/lib/workspace";
import { readJson, revenueError } from "@/lib/revenue/api";
import { answerCallQuestion } from "@/lib/revenue/ask";

type Context = { params: Promise<{ id: string }> };

async function POSTHandler(request: Request, context: Context) {
  try {
    const auth = await requireWorkspace();
    const { id } = await context.params;
    const body = await readJson(request);
    return NextResponse.json(await answerCallQuestion(auth, id, body.question));
  } catch (error) {
    return revenueError(error);
  }
}

export const POST = withWorkspaceApi(POSTHandler, {});
export const dynamic = "force-dynamic";
export const maxDuration = 60;

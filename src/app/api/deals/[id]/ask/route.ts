import { NextResponse } from "next/server";
import { withWorkspaceApi } from "@/lib/workspace";
import { requireRevenueAdmin } from "@/lib/revenue/access";
import { readJson, revenueError } from "@/lib/revenue/api";
import { answerDealQuestion } from "@/lib/revenue/ask";

type Context = { params: Promise<{ id: string }> };

async function POSTHandler(request: Request, context: Context) {
  try {
    const auth = await requireRevenueAdmin();
    const { id } = await context.params;
    const body = await readJson(request);
    return NextResponse.json(await answerDealQuestion(auth, id, body.question));
  } catch (error) {
    return revenueError(error);
  }
}

export const POST = withWorkspaceApi(POSTHandler, { admin: true });
export const dynamic = "force-dynamic";
export const maxDuration = 60;

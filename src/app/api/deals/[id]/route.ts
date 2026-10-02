import { NextResponse } from "next/server";
import { withWorkspaceApi } from "@/lib/workspace";
import { requireRevenueAdmin } from "@/lib/revenue/access";
import { readJson, revenueError } from "@/lib/revenue/api";
import { dealDetail, dealEvidence, saveDealReview } from "@/lib/revenue/forecast";
type Context = { params: Promise<{ id: string }> };
export const GET = withWorkspaceApi(async (request: Request, context: Context) => {
  try {
    const auth = await requireRevenueAdmin(); const { id } = await context.params;
    const callId = new URL(request.url).searchParams.get("callId");
    return NextResponse.json(callId ? { segments: await dealEvidence(auth, id, callId) } : await dealDetail(auth, id));
  } catch (error) { return revenueError(error); }
}, { admin: true });
export const PUT = withWorkspaceApi(async (request: Request, context: Context) => {
  try { const auth = await requireRevenueAdmin(); const { id } = await context.params; await saveDealReview(auth, id, await readJson(request)); return NextResponse.json(await dealDetail(auth, id)); }
  catch (error) { return revenueError(error); }
}, { admin: true });
export const dynamic = "force-dynamic";

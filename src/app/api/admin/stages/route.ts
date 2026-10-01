import { withWorkspaceApi } from "@/lib/workspace";
import { NextResponse } from "next/server";
import { addCallStage, deleteCallStage, getCallStages, renameCallStage } from "@/lib/db/service";
import { requireWorkspace, workspaceErrorResponse } from "@/lib/workspace";

async function GETHandler() {
  try {
    await requireWorkspace();
    const stages = await getCallStages();
    return NextResponse.json({ stages });
  } catch (err: any) {
    return workspaceErrorResponse(err);
  }
}

async function POSTHandler(req: Request) {
  try {
    await requireWorkspace();
    const body = await req.json();
    const stages = await addCallStage(body.name || body.stage || "");
    return NextResponse.json({ success: true, stages });
  } catch (err: any) {
    const gated = workspaceErrorResponse(err);
    if (gated.status !== 500) return gated;
    const status = err.message?.includes("required") ? 400 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

async function PATCHHandler(req: Request) {
  try {
    await requireWorkspace();
    const body = await req.json();
    const stages = await renameCallStage(body.from || "", body.to || "");
    return NextResponse.json({ success: true, stages });
  } catch (err: any) {
    const gated = workspaceErrorResponse(err);
    if (gated.status !== 500) return gated;
    const msg = err.message || "Failed to update Call Stage Target";
    const status = /required|already exists|Unknown/.test(msg) ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

async function DELETEHandler(req: Request) {
  try {
    await requireWorkspace();
    const body = await req.json();
    const stages = await deleteCallStage(body.name || body.stage || "");
    return NextResponse.json({ success: true, stages });
  } catch (err: any) {
    const gated = workspaceErrorResponse(err);
    if (gated.status !== 500) return gated;
    const msg = err.message || "Failed to remove Call Stage Target";
    const status = /required|still has scripts|at least one/.test(msg) ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export const GET = withWorkspaceApi(GETHandler, { admin: true });
export const POST = withWorkspaceApi(POSTHandler, { admin: true });
export const PATCH = withWorkspaceApi(PATCHHandler, { admin: true });
export const DELETE = withWorkspaceApi(DELETEHandler, { admin: true });

export const dynamic = "force-dynamic";

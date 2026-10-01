import { withWorkspaceApi } from "@/lib/workspace";
import { NextResponse } from "next/server";
import { deleteScript } from "@/lib/db/service";
import { requireWorkspace, workspaceErrorResponse } from "@/lib/workspace";

async function DELETEHandler(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireWorkspace();
    const { id } = await params;
    await deleteScript(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return workspaceErrorResponse(err);
  }
}

export const DELETE = withWorkspaceApi(DELETEHandler, { admin: true });

export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { deleteScript } from "@/lib/db/service";
import { requireWorkspace, workspaceErrorResponse } from "@/lib/workspace";

export async function DELETE(
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

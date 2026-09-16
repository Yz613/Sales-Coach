import { NextResponse } from "next/server";
import { getCallStages } from "@/lib/db/service";
import { requireWorkspace, workspaceErrorResponse } from "@/lib/workspace";

/** Member-accessible list of Call Stage Targets (defaults + custom script types). */
export async function GET() {
  try {
    await requireWorkspace();
    const stages = await getCallStages();
    return NextResponse.json({ stages });
  } catch (err: any) {
    return workspaceErrorResponse(err);
  }
}

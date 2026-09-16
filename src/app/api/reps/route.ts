import { NextResponse } from "next/server";
import { getAllReps } from "@/lib/db/service";
import { isOwnRep } from "@/lib/call-access";
import { toCallViewer } from "@/lib/viewer-calls";
import { requireWorkspace, workspaceErrorResponse } from "@/lib/workspace";

export async function GET() {
  try {
    const auth = await requireWorkspace();
    const reps = await getAllReps();
    if (auth.canViewAllCalls) {
      return NextResponse.json(reps);
    }
    return NextResponse.json(reps.filter((rep) => isOwnRep(rep, toCallViewer(auth))));
  } catch (err: any) {
    return workspaceErrorResponse(err);
  }
}

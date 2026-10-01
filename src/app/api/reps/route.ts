import { withWorkspaceApi } from "@/lib/workspace";
import { NextResponse } from "next/server";
import { getAllReps } from "@/lib/db/service";
import { isOwnRep } from "@/lib/call-access";
import { toCallViewer } from "@/lib/viewer-calls";
import { requireWorkspace, workspaceErrorResponse } from "@/lib/workspace";

async function GETHandler() {
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

export const GET = withWorkspaceApi(GETHandler, { admin: true });

export const dynamic = "force-dynamic";

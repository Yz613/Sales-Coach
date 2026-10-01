import { withWorkspaceApi } from "@/lib/workspace";
import { NextResponse } from "next/server";
import { getExecutiveAnalytics } from "@/lib/db/service";
import { requireWorkspace, workspaceErrorResponse } from "@/lib/workspace";

async function GETHandler() {
  try {
    await requireWorkspace();
    const analytics = await getExecutiveAnalytics();
    return NextResponse.json(analytics);
  } catch (err: any) {
    return workspaceErrorResponse(err);
  }
}

export const GET = withWorkspaceApi(GETHandler, { admin: true });

export const dynamic = "force-dynamic";

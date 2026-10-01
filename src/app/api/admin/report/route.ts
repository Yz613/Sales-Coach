import { withWorkspaceApi } from "@/lib/workspace";
import { NextResponse } from "next/server";
import { getSuperAdminReport } from "@/lib/db/service";
import { requireWorkspace, workspaceErrorResponse } from "@/lib/workspace";

async function GETHandler() {
  try {
    await requireWorkspace();
    const report = await getSuperAdminReport();
    return NextResponse.json(report);
  } catch (err: any) {
    return workspaceErrorResponse(err);
  }
}

export const GET = withWorkspaceApi(GETHandler, { admin: true });

export const dynamic = "force-dynamic";

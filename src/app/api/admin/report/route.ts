import { NextResponse } from "next/server";
import { getSuperAdminReport } from "@/lib/db/service";
import { requireWorkspace, workspaceErrorResponse } from "@/lib/workspace";

export async function GET() {
  try {
    await requireWorkspace();
    const report = await getSuperAdminReport();
    return NextResponse.json(report);
  } catch (err: any) {
    return workspaceErrorResponse(err);
  }
}

import { NextResponse } from "next/server";
import { getExecutiveAnalytics } from "@/lib/db/service";
import { requireWorkspace, workspaceErrorResponse } from "@/lib/workspace";

export async function GET() {
  try {
    await requireWorkspace();
    const analytics = await getExecutiveAnalytics();
    return NextResponse.json(analytics);
  } catch (err: any) {
    return workspaceErrorResponse(err);
  }
}

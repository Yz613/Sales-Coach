import { NextResponse } from "next/server";
import { withWorkspaceApi } from "@/lib/workspace";
import { getConnection } from "@/lib/revenue/connections";
import { listScheduledMeetings } from "@/lib/revenue/meetings";
import { isCalendarTool } from "@/lib/integrations/catalog";
import { RevenueError } from "@/lib/revenue/security";
import { revenueError } from "@/lib/revenue/api";
export const GET = withWorkspaceApi(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  try {
    const connection = await getConnection((await ctx.params).id);
    if (!isCalendarTool(connection.provider)) throw new RevenueError("This connection has no meeting schedule.");
    return NextResponse.json({ meetings: await listScheduledMeetings(connection.id, new URL(req.url).searchParams.get("past") === "1") });
  } catch (error) { return revenueError(error); }
}, { admin: true });
export const dynamic = "force-dynamic";

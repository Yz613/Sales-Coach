import { NextResponse, after } from "next/server";
import { withWorkspaceApi } from "@/lib/workspace";
import { requireRevenueAdmin } from "@/lib/revenue/access";
import { actorId } from "@/lib/revenue/conversations";
import { getConnection } from "@/lib/revenue/connections";
import { taskWorkspace, queueTaskExport, retryTaskExport } from "@/lib/revenue/tasks";
import { isTaskTool } from "@/lib/integrations/catalog";
import { readJson, revenueError } from "@/lib/revenue/api";
import { RevenueError, textInput } from "@/lib/revenue/security";
import { currentTenantId } from "@/lib/tenant";
import { processJobs } from "@/lib/revenue/jobs";
type Context = { params: Promise<{ id: string }> };
export const GET = withWorkspaceApi(async (_req: Request, ctx: Context) => {
  try {
    const connection = await getConnection((await ctx.params).id);
    if (!isTaskTool(connection.provider)) throw new RevenueError("This connection has no task workspace.");
    return NextResponse.json(await taskWorkspace(connection.id));
  } catch (error) { return revenueError(error); }
}, { admin: true });
export const POST = withWorkspaceApi(async (req: Request, ctx: Context) => {
  try {
    const auth = await requireRevenueAdmin(); const connection = await getConnection((await ctx.params).id);
    if (!isTaskTool(connection.provider)) throw new RevenueError("Choose a task integration.");
    const body = await readJson(req); const actor = actorId(auth);
    const result = body.action === "retry" ? await retryTaskExport(connection.id, textInput(body.exportId, "Export ID", 200), body.confirmedMissing === true, actor)
      : body.action === "send" ? await queueTaskExport(connection.id, textInput(body.callId, "Call ID", 200), textInput(body.actionId, "Action item ID", 200), actor)
      : (() => { throw new RevenueError("Choose send or retry."); })();
    const orgId = currentTenantId(); after(() => processJobs(orgId, 1, [result.jobId]));
    return NextResponse.json(result, { status: 202 });
  } catch (error) { return revenueError(error); }
}, { admin: true });
export const dynamic = "force-dynamic";

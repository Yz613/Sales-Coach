import { NextResponse, after } from "next/server";
import { withWorkspaceApi } from "@/lib/workspace";
import { requireRevenueAdmin } from "@/lib/revenue/access";
import { getConnection } from "@/lib/revenue/connections";
import { authorizedSecrets } from "@/lib/integrations/oauth";
import { taskDestinations } from "@/lib/integrations/tasks";
import { isTaskTool } from "@/lib/integrations/catalog";
import { RevenueError } from "@/lib/revenue/security";
import { readJson, revenueError } from "@/lib/revenue/api";
import { actorId } from "@/lib/revenue/conversations";
import { completeTaskSetup } from "@/lib/revenue/integration-setup";
import { enqueueSync, processJobs } from "@/lib/revenue/jobs";
import { currentTenantId } from "@/lib/tenant";
import type { TaskProvider } from "@/lib/revenue/types";
type Context = { params: Promise<{ id: string }> };
export const GET = withWorkspaceApi(async (req: Request, ctx: Context) => {
  try {
    await requireRevenueAdmin(); const connection = await getConnection((await ctx.params).id);
    if (!isTaskTool(connection.provider) || !connection.config.pendingSetup) throw new RevenueError("Choose a task connection awaiting setup.", 409);
    const params = new URL(req.url).searchParams;
    return NextResponse.json(await taskDestinations(connection.provider as TaskProvider, await authorizedSecrets(connection), params.get("group") || "", params.get("groupId") || "", params.get("cursor") || ""));
  } catch (error) { return revenueError(error); }
}, { admin: true });
export const POST = withWorkspaceApi(async (req: Request, ctx: Context) => {
  try {
    const auth = await requireRevenueAdmin(); const id = (await ctx.params).id;
    await completeTaskSetup(id, await readJson(req), actorId(auth));
    await enqueueSync(id); const orgId = currentTenantId(); after(() => processJobs(orgId, 4));
    return NextResponse.json({ ok: true });
  } catch (error) { return revenueError(error); }
}, { admin: true });
export const dynamic = "force-dynamic";

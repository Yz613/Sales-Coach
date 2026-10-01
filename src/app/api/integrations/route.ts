import { withWorkspaceApi } from "@/lib/workspace";
import { NextResponse, after } from "next/server";
import { requireRevenueAdmin } from "@/lib/revenue/access";
import { listConnections, connectIntegration } from "@/lib/revenue/connections";
import { enqueueSync, listJobs, processJobs } from "@/lib/revenue/jobs";
import { readJson, revenueError } from "@/lib/revenue/api";
import { currentTenantId } from "@/lib/tenant";
import { actorId } from "@/lib/revenue/conversations";
export const dynamic = "force-dynamic";
async function GETHandler() { try { await requireRevenueAdmin(); return NextResponse.json({ connections: await listConnections(), jobs: await listJobs() }); } catch (e) { return revenueError(e); } }
async function POSTHandler(req: Request) {
  try { const auth = await requireRevenueAdmin(); const id = await connectIntegration(await readJson(req), actorId(auth)); const jobId = await enqueueSync(id); const orgId = currentTenantId(); after(() => processJobs(orgId, 2)); return NextResponse.json({ id, jobId }, { status: 201 }); } catch (e) { return revenueError(e); }
}

export const GET = withWorkspaceApi(GETHandler, {});
export const POST = withWorkspaceApi(POSTHandler, {});

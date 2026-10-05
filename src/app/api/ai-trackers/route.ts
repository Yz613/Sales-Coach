import { withWorkspaceApi } from "@/lib/workspace";
import { NextResponse, after } from "next/server";
import { requireWorkspace } from "@/lib/workspace";
import { requireRevenueAdmin } from "@/lib/revenue/access";
import { actorId } from "@/lib/revenue/conversations";
import { createConceptTracker, deleteConceptTracker, listConceptTrackers, rescanConceptTracker } from "@/lib/revenue/alerts";
import { processJobs } from "@/lib/revenue/jobs";
import { readJson, revenueError } from "@/lib/revenue/api";
import { currentTenantId } from "@/lib/tenant";

async function GETHandler() {
  try { await requireWorkspace(); return NextResponse.json(await listConceptTrackers()); }
  catch (e) { return revenueError(e); }
}
async function POSTHandler(req: Request) {
  try {
    const auth = await requireRevenueAdmin();
    const body = await readJson(req);
    if (body.action === "scan") await rescanConceptTracker(String(body.id));
    else await createConceptTracker(body, actorId(auth));
    const orgId = currentTenantId();
    after(() => processJobs(orgId, 4));
    return NextResponse.json({ ok: true }, { status: body.action === "scan" ? 200 : 201 });
  } catch (e) { return revenueError(e); }
}
async function DELETEHandler(req: Request) {
  try { await requireRevenueAdmin(); const { id } = await readJson(req); await deleteConceptTracker(String(id)); return NextResponse.json({ ok: true }); }
  catch (e) { return revenueError(e); }
}

export const GET = withWorkspaceApi(GETHandler, {});
export const POST = withWorkspaceApi(POSTHandler, {});
export const DELETE = withWorkspaceApi(DELETEHandler, {});
export const dynamic = "force-dynamic";

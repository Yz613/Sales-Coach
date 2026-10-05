import { withWorkspaceApi } from "@/lib/workspace";
import { NextResponse, after } from "next/server";
import { requireWorkspace } from "@/lib/workspace";
import { requireRevenueAdmin } from "@/lib/revenue/access";
import { actorId } from "@/lib/revenue/conversations";
import { createStream, deleteStream, listStreamAlerts, listStreams, markStreamAlertRead } from "@/lib/revenue/alerts";
import { processJobs } from "@/lib/revenue/jobs";
import { readJson, revenueError } from "@/lib/revenue/api";
import { currentTenantId } from "@/lib/tenant";

async function GETHandler() {
  try {
    const auth = await requireWorkspace();
    return NextResponse.json({ streams: auth.isAdmin ? await listStreams() : [], alerts: await listStreamAlerts(auth) });
  } catch (e) { return revenueError(e); }
}
async function POSTHandler(req: Request) {
  try {
    const body = await readJson(req);
    if (body.action === "read") {
      const auth = await requireWorkspace();
      await markStreamAlertRead(auth, String(body.id));
      return NextResponse.json({ ok: true });
    }
    const auth = await requireRevenueAdmin();
    const id = await createStream(body, actorId(auth));
    const orgId = currentTenantId();
    after(() => processJobs(orgId, 4));
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) { return revenueError(e); }
}
async function DELETEHandler(req: Request) {
  try { await requireRevenueAdmin(); const { id } = await readJson(req); await deleteStream(String(id)); return NextResponse.json({ ok: true }); }
  catch (e) { return revenueError(e); }
}

export const GET = withWorkspaceApi(GETHandler, {});
export const POST = withWorkspaceApi(POSTHandler, {});
export const DELETE = withWorkspaceApi(DELETEHandler, {});
export const dynamic = "force-dynamic";

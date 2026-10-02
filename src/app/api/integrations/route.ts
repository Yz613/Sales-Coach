import { withWorkspaceApi } from "@/lib/workspace";
import { NextResponse, after } from "next/server";
import { requireRevenueAdmin } from "@/lib/revenue/access";
import { listConnections, connectIntegration, getConnection, saveConnectionSecrets } from "@/lib/revenue/connections";
import { enqueueSync, listJobs, processJobs } from "@/lib/revenue/jobs";
import { readJson, revenueError } from "@/lib/revenue/api";
import { currentTenantId } from "@/lib/tenant";
import { actorId } from "@/lib/revenue/conversations";
import { integrationTool } from "@/lib/integrations/catalog";
import { enableLiveFeed } from "@/lib/integrations/live";
import { RevenueError } from "@/lib/revenue/security";
import { oauthAvailability } from "@/lib/integrations/oauth";
export const dynamic = "force-dynamic";
async function GETHandler() { try { await requireRevenueAdmin(); return NextResponse.json({ connections: await listConnections(), jobs: await listJobs(), oauth: oauthAvailability() }); } catch (e) { return revenueError(e); } }
async function POSTHandler(req: Request) {
  try {
    const auth = await requireRevenueAdmin(); const body = await readJson(req); const actor = actorId(auth);
    const id = await connectIntegration(body, actor); const tool = integrationTool(body.provider)!;
    let feed: { url: string; token?: string } | undefined; let warning: string | undefined;
    if (tool.live !== "none" && (tool.id !== "hubspot" || body.webhookSecret)) {
      try { feed = await enableLiveFeed(id, actor, new URL(req.url).origin); }
      catch (error) {
        warning = error instanceof RevenueError ? error.message : "Connected, but the live feed could not be enabled. Open the connection to retry.";
        const connection = await getConnection(id); await saveConnectionSecrets(id, connection.secrets, { ...connection.config, webhookError: warning });
      }
    }
    const jobId = tool.syncMinutes ? await enqueueSync(id) : undefined; const orgId = currentTenantId();
    if (jobId) after(() => processJobs(orgId, 4));
    return NextResponse.json({ id, jobId, feed, warning }, { status: 201 });
  } catch (e) { return revenueError(e); }
}

export const GET = withWorkspaceApi(GETHandler, {});
export const POST = withWorkspaceApi(POSTHandler, {});

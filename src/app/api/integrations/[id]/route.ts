import { withWorkspaceApi } from "@/lib/workspace";
import { NextResponse, after } from "next/server";
import { requireRevenueAdmin } from "@/lib/revenue/access";
import { getConnection, disconnectIntegration, saveConnectionSecrets, audit } from "@/lib/revenue/connections";
import { enqueueSync, processJobs } from "@/lib/revenue/jobs";
import { readJson, revenueError } from "@/lib/revenue/api";
import { actorId } from "@/lib/revenue/conversations";
import { fathomRequest } from "@/lib/integrations/fathom";
import { currentTenantId } from "@/lib/tenant";
import { RevenueError, textInput } from "@/lib/revenue/security";
import { enableLiveFeed } from "@/lib/integrations/live";
import { integrationTool, isCallTool } from "@/lib/integrations/catalog";
type Context = { params: Promise<{ id: string }> };
async function POSTHandler(req: Request, ctx: Context) {
  try {
    const auth = await requireRevenueAdmin(); const { id } = await ctx.params; const body = await readJson(req); const connection = await getConnection(id); const orgId = currentTenantId();
    if (body.action === "sync") { const jobId = await enqueueSync(id, Boolean(body.full)); after(() => processJobs(orgId, 4)); return NextResponse.json({ jobId }); }
    if (body.action === "configure") {
      const config = { ...connection.config, autoSync: Boolean(integrationTool(connection.provider)?.syncMinutes) && body.autoSync === true, autoEvaluate: isCallTool(connection.provider) && body.autoEvaluate === true, defaultStage: textInput(body.defaultStage || connection.config.defaultStage, "Default call stage", 100) };
      await saveConnectionSecrets(id, connection.secrets, config); await audit(actorId(auth), "integration.configured", id); return NextResponse.json({ ok: true });
    }
    if (body.action === "webhook") {
      return NextResponse.json(await enableLiveFeed(id, actorId(auth), new URL(req.url).origin, body.webhookSecret));
    }
    throw new RevenueError("Unknown integration action.");
  } catch (e) { return revenueError(e); }
}
async function DELETEHandler(_req: Request, ctx: Context) {
  try { const auth = await requireRevenueAdmin(); const { id } = await ctx.params; const connection = await getConnection(id);
    if (connection.provider === "fathom" && connection.config.webhookId) {
      try { await fathomRequest(connection.secrets.token, `/webhooks/${encodeURIComponent(connection.config.webhookId)}`, { method: "DELETE" }); }
      catch { /* Local disconnection still revokes webhook acceptance when the remote account is unavailable. */ }
    }
    await disconnectIntegration(id, actorId(auth)); return NextResponse.json({ ok: true });
  } catch (e) { return revenueError(e); }
}

export const POST = withWorkspaceApi(POSTHandler, {});
export const DELETE = withWorkspaceApi(DELETEHandler, {});

export const dynamic = "force-dynamic";

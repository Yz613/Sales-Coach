import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { integrationConnections, processingJobs } from "@/lib/db/schema";
import { withWorkspaceApi } from "@/lib/workspace";
import { NextResponse, after } from "next/server";
import { requireRevenueAdmin } from "@/lib/revenue/access";
import { getConnection, disconnectIntegration, saveConnectionConfig, saveConnectionSecrets, audit } from "@/lib/revenue/connections";
import { enqueueSync, enqueueJob, processJobs } from "@/lib/revenue/jobs";
import { readJson, revenueError } from "@/lib/revenue/api";
import { actorId } from "@/lib/revenue/conversations";
import { fathomRequest } from "@/lib/integrations/fathom";
import { currentTenantId } from "@/lib/tenant";
import { RevenueError, textInput } from "@/lib/revenue/security";
import { enableLiveFeed } from "@/lib/integrations/live";
import { integrationTool, isCallTool, isNotificationTool } from "@/lib/integrations/catalog";
import { slackPreferences } from "@/lib/integrations/slack";
import { aircallRequest } from "@/lib/integrations/aircall";
import { deleteQuoWebhook } from "@/lib/integrations/quo";
import { automationDestination } from "@/lib/integrations/outbound";
type Context = { params: Promise<{ id: string }> };
async function POSTHandler(req: Request, ctx: Context) {
  try {
    const auth = await requireRevenueAdmin(); const { id } = await ctx.params; const body = await readJson(req); const orgId = currentTenantId();
    if (body.action === "confirm-provider-revoked") {
      if (body.confirmed !== true) throw new RevenueError("Confirm that access has been revoked in your provider settings.");
      const changed = await db.update(integrationConnections).set({ credentials: "", config: "{}", lastError: null, updatedAt: new Date().toISOString() }).where(and(eq(integrationConnections.id, id), eq(integrationConnections.orgId, orgId), eq(integrationConnections.status, "disconnected"))).returning({ id: integrationConnections.id }).all();
      if (!changed.length) throw new RevenueError("Disconnected integration not found.", 404);
      await db.update(processingJobs).set({ status: "cancelled", payload: "{}", leaseToken: null, leaseUntil: null }).where(and(eq(processingJobs.orgId, orgId), eq(processingJobs.connectionId, id), eq(processingJobs.kind, "revoke-integration"), inArray(processingJobs.status, ["queued", "failed", "running"]))).run();
      await audit(actorId(auth), "integration.provider-revocation-confirmed", id); return NextResponse.json({ ok: true });
    }
    const connection = await getConnection(id);
    if (body.action === "sync") { const jobId = await enqueueSync(id, Boolean(body.full)); after(() => processJobs(orgId, 4)); return NextResponse.json({ jobId }); }
    if (body.action === "disable-writes") {
      await saveConnectionConfig(id, { ...connection.config, writeEnabled: false, exportReviewed: false });
      await audit(actorId(auth), "integration.writes-disabled", id); return NextResponse.json({ ok: true });
    }
    if (body.action === "enable-writes") {
      if (connection.config.authMethod === "oauth") throw new RevenueError("Authorize sending through provider sign-in to grant write permissions.", 409);
      if (!["Tasks", "CRM"].includes(integrationTool(connection.provider)?.category || "")) throw new RevenueError("This provider does not support this action.");
      if (connection.provider === "gitlab" && !connection.secrets.projectScoped) throw new RevenueError("Reconnect with a project access token.", 409);
      await saveConnectionConfig(id, { ...connection.config, writeEnabled: true });
      await audit(actorId(auth), "integration.writes-enabled", id); return NextResponse.json({ ok: true });
    }
    if (body.action === "configure") {
      if (body.exportReviewed === true && connection.config.writeEnabled !== true) throw new RevenueError("Authorize sending before enabling CRM exports.", 409);
      const config = { ...connection.config, autoSync: !connection.config.pendingSetup && Boolean(integrationTool(connection.provider)?.syncMinutes) && body.autoSync === true, autoEvaluate: isCallTool(connection.provider) && body.autoEvaluate === true, defaultStage: textInput(body.defaultStage || connection.config.defaultStage, "Default call stage", 100),
        exportReviewed: integrationTool(connection.provider)?.category === "CRM" && body.exportReviewed === true,
        outboundOnImported: connection.config.outboundConfigured === true && body.outboundOnImported === true,
        outboundOnReviewed: connection.config.outboundConfigured === true && body.outboundOnReviewed === true,
        ...(isNotificationTool(connection.provider) ? slackPreferences(body, connection.config) : {}) };
      await saveConnectionConfig(id, config); await audit(actorId(auth), "integration.configured", id); return NextResponse.json({ ok: true });
    }
    if (body.action === "destination" && ["zapier", "make"].includes(connection.provider)) {
      const destination = automationDestination(connection.provider, textInput(body.outboundWebhookUrl, "Outbound webhook URL", 4096));
      await saveConnectionSecrets(id, { ...connection.secrets, outboundWebhookUrl: destination.toString() }, { ...connection.config, outboundConfigured: true, outboundOnImported: body.outboundOnImported === true, outboundOnReviewed: body.outboundOnReviewed === true });
      await audit(actorId(auth), "integration.outbound-configured", id); return NextResponse.json({ ok: true });
    }
    if (body.action === "webhook") {
      return NextResponse.json(await enableLiveFeed(id, actorId(auth), new URL(req.url).origin, body.webhookSecret));
    }
    if (body.action === "test" && isNotificationTool(connection.provider)) {
      const jobId = await enqueueJob({ kind: "notify-slack", connectionId: id, payload: { event: "test" }, key: `${id}:test:${crypto.randomUUID()}` });
      after(() => processJobs(orgId, 1, [jobId])); return NextResponse.json({ jobId });
    }
    throw new RevenueError("Unknown integration action.");
  } catch (e) { return revenueError(e); }
}
async function DELETEHandler(_req: Request, ctx: Context) {
  try { const auth = await requireRevenueAdmin(); const { id } = await ctx.params; const connection = await getConnection(id);
    const result = await disconnectIntegration(id, actorId(auth));
    if (connection.provider === "fathom" && connection.config.webhookId) {
      try { await fathomRequest(connection.secrets.token, `/webhooks/${encodeURIComponent(connection.config.webhookId)}`, { method: "DELETE" }); }
      catch { /* Local disconnection still revokes webhook acceptance when the remote account is unavailable. */ }
    }
    if (connection.provider === "aircall" && connection.config.webhookId) {
      try { await aircallRequest(connection.secrets, `/webhooks/${encodeURIComponent(connection.config.webhookId)}`, { method: "DELETE" }); }
      catch { /* Disconnect still revokes local acceptance if remote cleanup fails. */ }
    }
    if (connection.provider === "quo" && connection.config.webhookId) {
      try { await deleteQuoWebhook(connection.secrets, connection.config.webhookId); }
      catch { /* Disconnect still revokes local acceptance if remote cleanup fails. */ }
    }
    const orgId = currentTenantId(); after(() => processJobs(orgId, 2));
    return NextResponse.json({ ok: true, ...result });
  } catch (e) { return revenueError(e); }
}

export const POST = withWorkspaceApi(POSTHandler, {});
export const DELETE = withWorkspaceApi(DELETEHandler, {});

export const dynamic = "force-dynamic";

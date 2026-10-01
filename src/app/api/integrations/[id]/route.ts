import { withWorkspaceApi } from "@/lib/workspace";
import { NextResponse, after } from "next/server";
import { requireRevenueAdmin } from "@/lib/revenue/access";
import { getConnection, disconnectIntegration, saveConnectionSecrets, audit } from "@/lib/revenue/connections";
import { enqueueSync, processJobs } from "@/lib/revenue/jobs";
import { readJson, revenueError } from "@/lib/revenue/api";
import { actorId } from "@/lib/revenue/conversations";
import { fathomRequest } from "@/lib/integrations/fathom";
import { currentTenantId } from "@/lib/tenant";
import { runtimeSecret } from "@/lib/revenue/runtime";
import { RevenueError, safeExternalUrl, textInput } from "@/lib/revenue/security";
type Context = { params: Promise<{ id: string }> };
async function POSTHandler(req: Request, ctx: Context) {
  try {
    const auth = await requireRevenueAdmin(); const { id } = await ctx.params; const body = await readJson(req); const connection = await getConnection(id); const orgId = currentTenantId();
    if (body.action === "sync") { const jobId = await enqueueSync(id, Boolean(body.full)); after(() => processJobs(orgId, 4)); return NextResponse.json({ jobId }); }
    if (body.action === "configure") {
      const config = { ...connection.config, autoSync: body.autoSync === true, autoEvaluate: body.autoEvaluate === true, defaultStage: textInput(body.defaultStage || connection.config.defaultStage, "Default call stage", 100) };
      await saveConnectionSecrets(id, connection.secrets, config); await audit(actorId(auth), "integration.configured", id); return NextResponse.json({ ok: true });
    }
    if (body.action === "webhook") {
      if (connection.provider !== "fathom") throw new RevenueError("Only Fathom supports meeting webhooks here.");
      if (connection.config.webhookId) return NextResponse.json({ url: connection.config.webhookUrl });
      const origin = safeExternalUrl(runtimeSecret("PUBLIC_APP_URL") || new URL(req.url).origin);
      if (!origin || ["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname)) throw new RevenueError("Set PUBLIC_APP_URL to the public HTTPS address of your app before enabling webhooks.");
      const url = new URL(`/app/api/webhooks/fathom?connection=${encodeURIComponent(id)}`, origin).toString();
      const hook = await fathomRequest<{ id: string; secret: string }>(connection.secrets.token, "/webhooks", { method: "POST", body: JSON.stringify({ destination_url: url, triggered_for: ["my_recordings", "my_shared_with_team_recordings"], include_transcript: true, include_summary: true, include_action_items: true, include_crm_matches: true }) });
      await saveConnectionSecrets(id, { ...connection.secrets, webhookSecret: hook.secret }, { ...connection.config, webhookId: String(hook.id), webhookUrl: url });
      await audit(actorId(auth), "integration.webhook.created", id); return NextResponse.json({ url });
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

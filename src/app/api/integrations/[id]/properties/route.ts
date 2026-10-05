import { NextResponse, after } from "next/server";
import { withWorkspaceApi } from "@/lib/workspace";
import { requireRevenueAdmin } from "@/lib/revenue/access";
import { actorId } from "@/lib/revenue/conversations";
import { audit, getConnection, saveConnectionConfig } from "@/lib/revenue/connections";
import { listPropertyWrites, queueManualPropertyWrite, retryPropertyWrite } from "@/lib/revenue/property-writes";
import { readJson, revenueError } from "@/lib/revenue/api";
import { RevenueError, textInput } from "@/lib/revenue/security";
import { parsePropertyMappings } from "@/lib/integrations/hubspot-properties";
import { currentTenantId } from "@/lib/tenant";
import { processJobs } from "@/lib/revenue/jobs";

type Context = { params: Promise<{ id: string }> };

export const GET = withWorkspaceApi(async (_req: Request, ctx: Context) => {
  try { return NextResponse.json({ writes: await listPropertyWrites((await ctx.params).id) }); } catch (error) { return revenueError(error); }
}, { admin: true });

export const POST = withWorkspaceApi(async (req: Request, ctx: Context) => {
  try {
    const auth = await requireRevenueAdmin();
    const connection = await getConnection((await ctx.params).id);
    const body = await readJson(req);
    const actor = actorId(auth);
    const orgId = currentTenantId();
    if (body.action === "save") {
      if (connection.provider !== "hubspot") throw new RevenueError("Property mapping is available for HubSpot.");
      const propertyMappings = parsePropertyMappings(body.propertyMappings);
      const writePropertiesOnReview = body.writePropertiesOnReview === true;
      if (writePropertiesOnReview && !propertyMappings.length) throw new RevenueError("Map at least one HubSpot property before enabling updates on review.");
      await saveConnectionConfig(connection.id, { ...connection.config, propertyMappings, writePropertiesOnReview });
      await audit(actor, "integration.property-mapping.saved", connection.id);
      return NextResponse.json({ ok: true, propertyMappings, writePropertiesOnReview });
    }
    if (body.action === "retry") {
      const result = await retryPropertyWrite(connection.id, textInput(body.writeId, "Property update", 200), body.confirmed === true, actor);
      schedulePropertyJobs(orgId);
      return NextResponse.json(result, { status: 202 });
    }
    if (body.action === "write") {
      const results = await queueManualPropertyWrite(connection.id, textInput(body.callId, "Call ID", 200), actor, body.targetId ? textInput(body.targetId, "CRM record ID", 200) : undefined);
      if (results.some(result => result.jobId)) schedulePropertyJobs(orgId);
      return NextResponse.json({ results }, { status: results.some(result => result.jobId) ? 202 : 200 });
    }
    throw new RevenueError("Choose save, write, or retry.");
  } catch (error) { return revenueError(error); }
}, { admin: true });

function schedulePropertyJobs(orgId: string) {
  try { after(() => processJobs(orgId, 4)); }
  catch (error) {
    if (!(error instanceof Error) || !error.message.includes("outside a request scope")) throw error;
  }
}

export const dynamic = "force-dynamic";

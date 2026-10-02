import { NextResponse, after } from "next/server";
import { withWorkspaceApi } from "@/lib/workspace";
import { requireRevenueAdmin, requireConversation } from "@/lib/revenue/access";
import { actorId } from "@/lib/revenue/conversations";
import { getConnection, audit } from "@/lib/revenue/connections";
import { listCallExports, queueCallExport, retryCallExport } from "@/lib/revenue/exports";
import { readJson, revenueError } from "@/lib/revenue/api";
import { RevenueError, textInput } from "@/lib/revenue/security";
import { currentTenantId } from "@/lib/tenant";
import { enqueueJob, processJobs } from "@/lib/revenue/jobs";
import { conversationClips } from "@/lib/db/schema";
import { db } from "@/lib/db";
import { and, eq } from "drizzle-orm";
type Context = { params: Promise<{ id: string }> };
export const GET = withWorkspaceApi(async (_req: Request, ctx: Context) => {
  try { return NextResponse.json({ exports: await listCallExports((await ctx.params).id) }); } catch (error) { return revenueError(error); }
}, { admin: true });
export const POST = withWorkspaceApi(async (req: Request, ctx: Context) => {
  try {
    const auth = await requireRevenueAdmin(); const connection = await getConnection((await ctx.params).id);
    const body = await readJson(req); const actor = actorId(auth); const orgId = currentTenantId();
    let result: { jobId: string };
    if (body.action === "retry") result = await retryCallExport(connection.id, textInput(body.exportId, "Export ID", 200), body.confirmedMissing === true, actor);
    else if (body.action === "send") {
      const callId = textInput(body.callId, "Call ID", 200); await requireConversation(callId);
      if (["slack", "discord"].includes(connection.provider)) {
        const clipId = body.clipId ? textInput(body.clipId, "Clip ID", 200) : undefined;
        if (clipId && !await db.select().from(conversationClips).where(and(eq(conversationClips.orgId, orgId), eq(conversationClips.callId, callId), eq(conversationClips.id, clipId))).get()) throw new RevenueError("Clip not found.", 404);
        result = { jobId: await enqueueJob({ kind: "notify-slack", connectionId: connection.id, callId, payload: { event: "share", clipId }, key: `${connection.id}:share:${callId}:${clipId || "full"}` }) };
        await audit(actor, "integration.call-shared", callId);
      } else result = await queueCallExport(connection.id, callId, actor, body.targetId ? textInput(body.targetId, "CRM record ID", 200) : undefined);
    } else throw new RevenueError("Choose send or retry.");
    after(() => processJobs(orgId, 1, [result.jobId])); return NextResponse.json(result, { status: 202 });
  } catch (error) { return revenueError(error); }
}, { admin: true });
export const dynamic = "force-dynamic";

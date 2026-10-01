import { withWorkspaceApi } from "@/lib/workspace";
import { NextResponse, after } from "next/server";
import { requireConversation } from "@/lib/revenue/access";
import { conversationDetail, updateConversation, actorId } from "@/lib/revenue/conversations";
import { deleteConversation, exportConversation } from "@/lib/revenue/privacy";
import { readJson, revenueError } from "@/lib/revenue/api";
import { enqueueJob, processJobs } from "@/lib/revenue/jobs";
import { currentTenantId } from "@/lib/tenant";
import { RevenueError } from "@/lib/revenue/security";
import { audit } from "@/lib/revenue/connections";
import { fathomRecording } from "@/lib/revenue/recording";
type Context = { params: Promise<{ id: string }> };
async function GETHandler(req: Request, ctx: Context) { try { const { id } = await ctx.params; const { auth, call } = await requireConversation(id); const format = new URL(req.url).searchParams.get("export");
  if (format) { const file = await exportConversation(call, format); await audit(actorId(auth), "conversation.exported", call.id); return new Response(file.content, { headers: { "content-type": `${file.mime}; charset=utf-8`, "content-disposition": `attachment; filename="call-${id.replace(/[^a-zA-Z0-9_-]/g, "")}.${file.extension}"`, "cache-control": "private, no-store" } }); }
  return NextResponse.json(await conversationDetail(call));
} catch(e) { return revenueError(e); } }
async function POSTHandler(req: Request, ctx: Context) { try { const { id } = await ctx.params; const { auth, call } = await requireConversation(id); const body = await readJson(req);
  if (body.action === "recording") return NextResponse.json(await fathomRecording(id, body.downloadId), { headers: { "cache-control": "private, no-store" } });
  if (body.action === "evaluate") { if (call.evaluation) throw new RevenueError("Use Reanalyze to replace an existing evaluation."); const jobId = await enqueueJob({ kind: "evaluate", callId: id, key: id }); const orgId = currentTenantId(); after(() => processJobs(orgId, 1)); return NextResponse.json({ jobId }); }
  return NextResponse.json(await updateConversation(auth, call, body));
} catch(e) { return revenueError(e); } }
async function DELETEHandler(_req: Request, ctx: Context) { try { const { id } = await ctx.params; const { auth } = await requireConversation(id); if (!auth.isAdmin) throw new RevenueError("Only an admin can delete a call.", 403); await deleteConversation(id, actorId(auth)); return NextResponse.json({ ok: true }); } catch(e) { return revenueError(e); } }

export const GET = withWorkspaceApi(GETHandler, {});
export const POST = withWorkspaceApi(POSTHandler, {});
export const DELETE = withWorkspaceApi(DELETEHandler, {});

export const dynamic = "force-dynamic";

import { withWorkspaceApi } from "@/lib/workspace";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireWorkspace } from "@/lib/workspace";
import { requireRevenueAdmin } from "@/lib/revenue/access";
import { actorId, createTracker, listTrackers } from "@/lib/revenue/conversations";
import { readJson, revenueError } from "@/lib/revenue/api";
import { db } from "@/lib/db";
import { conversationTrackers } from "@/lib/db/schema";
import { currentTenantId } from "@/lib/tenant";
async function GETHandler() { try { await requireWorkspace(); return NextResponse.json(await listTrackers()); } catch(e) { return revenueError(e); } }
async function POSTHandler(req: Request) { try { const auth = await requireRevenueAdmin(); const id = await createTracker(await readJson(req), actorId(auth)); return NextResponse.json({ id }, { status: 201 }); } catch(e) { return revenueError(e); } }
async function DELETEHandler(req: Request) { try { await requireRevenueAdmin(); const { id } = await readJson(req); await db.delete(conversationTrackers).where(and(eq(conversationTrackers.orgId, currentTenantId()), eq(conversationTrackers.id, String(id)))).run(); return NextResponse.json({ ok: true }); } catch(e) { return revenueError(e); } }

export const GET = withWorkspaceApi(GETHandler, {});
export const POST = withWorkspaceApi(POSTHandler, {});
export const DELETE = withWorkspaceApi(DELETEHandler, {});

export const dynamic = "force-dynamic";

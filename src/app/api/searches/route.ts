import { withWorkspaceApi } from "@/lib/workspace";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireWorkspace } from "@/lib/workspace";
import { ensureRevenueSchema, db } from "@/lib/db";
import { savedSearches } from "@/lib/db/schema";
import { currentTenantId } from "@/lib/tenant";
import { actorId, listSearches, saveSearch } from "@/lib/revenue/conversations";
import { readJson, revenueError } from "@/lib/revenue/api";
async function GETHandler() { try { const auth = await requireWorkspace(); await ensureRevenueSchema(); return NextResponse.json(await listSearches(auth)); } catch(e) { return revenueError(e); } }
async function POSTHandler(req: Request) { try { const auth = await requireWorkspace(); await ensureRevenueSchema(); await saveSearch(auth, await readJson(req)); return NextResponse.json({ ok: true }, { status: 201 }); } catch(e) { return revenueError(e); } }
async function DELETEHandler(req: Request) { try { const auth = await requireWorkspace(); await ensureRevenueSchema(); const { id } = await readJson(req); await db.delete(savedSearches).where(and(eq(savedSearches.orgId, currentTenantId()), eq(savedSearches.userId, actorId(auth)), eq(savedSearches.id, String(id)))).run(); return NextResponse.json({ ok: true }); } catch(e) { return revenueError(e); } }

export const GET = withWorkspaceApi(GETHandler, {});
export const POST = withWorkspaceApi(POSTHandler, {});
export const DELETE = withWorkspaceApi(DELETEHandler, {});

export const dynamic = "force-dynamic";

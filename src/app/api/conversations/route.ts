import { withWorkspaceApi } from "@/lib/workspace";
import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/workspace";
import { readFilters, searchConversations } from "@/lib/revenue/conversations";
import { revenueError } from "@/lib/revenue/api";
async function GETHandler(req: Request) { try { const auth = await requireWorkspace(); return NextResponse.json(await searchConversations(auth, readFilters(new URL(req.url).searchParams))); } catch(e) { return revenueError(e); } }

export const GET = withWorkspaceApi(GETHandler, {});

export const dynamic = "force-dynamic";

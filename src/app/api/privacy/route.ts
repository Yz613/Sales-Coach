import { withWorkspaceApi } from "@/lib/workspace";
import { NextResponse } from "next/server";
import { requireRevenueAdmin } from "@/lib/revenue/access";
import { actorId } from "@/lib/revenue/conversations";
import { privacySettings, setRetention, purgeExpiredConversations } from "@/lib/revenue/privacy";
import { readJson, revenueError } from "@/lib/revenue/api";
async function GETHandler() { try { await requireRevenueAdmin(); return NextResponse.json(await privacySettings()); } catch(e) { return revenueError(e); } }
async function POSTHandler(req: Request) { try { const auth = await requireRevenueAdmin(); const body = await readJson(req); if (body.action === "purge") return NextResponse.json(await purgeExpiredConversations()); await setRetention(body.retentionDays, actorId(auth)); return NextResponse.json(await privacySettings()); } catch(e) { return revenueError(e); } }

export const GET = withWorkspaceApi(GETHandler, {});
export const POST = withWorkspaceApi(POSTHandler, {});

export const dynamic = "force-dynamic";

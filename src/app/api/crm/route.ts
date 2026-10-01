import { withWorkspaceApi } from "@/lib/workspace";
import { NextResponse } from "next/server";
import { requireRevenueAdmin } from "@/lib/revenue/access";
import { crmOverview } from "@/lib/revenue/crm";
import { revenueError } from "@/lib/revenue/api";
async function GETHandler() { try { await requireRevenueAdmin(); return NextResponse.json(await crmOverview()); } catch(e) { return revenueError(e); } }

export const GET = withWorkspaceApi(GETHandler, {});

export const dynamic = "force-dynamic";

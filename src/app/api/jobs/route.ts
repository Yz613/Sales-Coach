import { withWorkspaceApi } from "@/lib/workspace";
import { NextResponse, after } from "next/server";
import { requireRevenueAdmin } from "@/lib/revenue/access";
import { listJobs, processJobs, retryJob } from "@/lib/revenue/jobs";
import { readJson, revenueError } from "@/lib/revenue/api";
import { currentTenantId } from "@/lib/tenant";
async function GETHandler() { try { await requireRevenueAdmin(); return NextResponse.json(await listJobs()); } catch(e) { return revenueError(e); } }
async function POSTHandler(req: Request) { try { await requireRevenueAdmin(); const body = await readJson(req); if (body.id) await retryJob(String(body.id)); const orgId = currentTenantId(); after(() => processJobs(orgId, 4)); return NextResponse.json({ queued: true }); } catch(e) { return revenueError(e); } }

export const GET = withWorkspaceApi(GETHandler, { admin: true });
export const POST = withWorkspaceApi(POSTHandler, { admin: true });

export const dynamic = "force-dynamic";

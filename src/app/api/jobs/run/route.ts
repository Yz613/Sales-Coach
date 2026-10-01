import { withPublicApi } from "@/lib/workspace";
import { NextResponse } from "next/server";
import { processJobs, scheduleSyncs } from "@/lib/revenue/jobs";
import { scheduledRetention } from "@/lib/revenue/privacy";
import { runtimeSecret } from "@/lib/revenue/runtime";
import { secureEqual } from "@/lib/revenue/security";
import { revenueError } from "@/lib/revenue/api";
export const maxDuration = 60;
async function POSTHandler(req: Request) {
  const secret = runtimeSecret("INTEGRATION_CRON_SECRET");
  if (secret.length < 32 || !secureEqual(req.headers.get("authorization") || "", `Bearer ${secret}`)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await scheduleSyncs(); const jobs = await processJobs(undefined, 8); await scheduledRetention(); return NextResponse.json({ jobs }); } catch(e) { return revenueError(e); }
}

export const POST = withPublicApi(POSTHandler, { webhook: true });

export const dynamic = "force-dynamic";

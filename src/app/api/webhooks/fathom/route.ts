import { withPublicApi } from "@/lib/workspace";
import { NextResponse, after } from "next/server";
import { eq } from "drizzle-orm";
import { db, ensureRevenueSchema } from "@/lib/db";
import { integrationConnections } from "@/lib/db/schema";
import { runWithTenant } from "@/lib/tenant";
import { normalizeFathomMeeting, verifyFathomWebhook } from "@/lib/integrations/fathom";
import { getConnection } from "@/lib/revenue/connections";
import { enqueueJob, processJobs } from "@/lib/revenue/jobs";
import { importedCallId } from "@/lib/revenue/imports";
import { readBody, revenueError } from "@/lib/revenue/api";
import { RevenueError } from "@/lib/revenue/security";
async function POSTHandler(req: Request) {
  try {
    await ensureRevenueSchema(); const id = new URL(req.url).searchParams.get("connection") || "";
    const row = await db.select({ id: integrationConnections.id, orgId: integrationConnections.orgId, status: integrationConnections.status }).from(integrationConnections).where(eq(integrationConnections.id, id)).get();
    if (!row || row.status === "disconnected") throw new RevenueError("Webhook not found.", 404);
    const raw = await readBody(req, 2000000);
    const jobId = await runWithTenant(row.orgId, async () => {
      const connection = await getConnection(row.id);
      if (connection.provider !== "fathom" || !verifyFathomWebhook(connection.secrets.webhookSecret || "", req.headers, raw)) throw new RevenueError("Invalid webhook signature.", 401);
      let data; try { data = JSON.parse(raw); } catch { throw new RevenueError("Invalid webhook payload."); }
      const meeting = normalizeFathomMeeting(data);
      return enqueueJob({ kind: "import", connectionId: row.id, callId: importedCallId(row.orgId, row.id, meeting.externalId), payload: meeting, key: `${row.id}:${meeting.externalId}` });
    });
    after(() => processJobs(row.orgId, 2)); return NextResponse.json({ accepted: true, jobId }, { status: 202 });
  } catch (e) { return revenueError(e); }
}

export const POST = withPublicApi(POSTHandler, { webhook: true });

export const dynamic = "force-dynamic";

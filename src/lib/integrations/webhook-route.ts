import { NextResponse, after } from "next/server";
import { acceptLiveWebhook } from "./live";
import { processJobs } from "../revenue/jobs";
import { readBody, revenueError } from "../revenue/api";

export async function liveWebhookResponse(req: Request, provider: string) {
  try {
    const id = new URL(req.url).searchParams.get("connection") || "";
    const accepted = await acceptLiveWebhook(provider, id, req.headers, await readBody(req, 2000000), req.url);
    // Process this event immediately even when a large historical import is queued.
    if (accepted.jobId) after(async () => {
      await processJobs(accepted.orgId, Math.min(10, accepted.jobIds.length), accepted.jobIds);
    });
    return NextResponse.json({ accepted: true, jobId: accepted.jobId }, { status: 202 });
  } catch (error) { return revenueError(error); }
}

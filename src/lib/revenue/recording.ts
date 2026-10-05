import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { callMetadata } from "../db/schema";
import { currentTenantId } from "../tenant";
import { getConnection } from "./connections";
import { fathomRequest } from "../integrations/fathom";
import { zoomPlayback } from "../integrations/zoom";
import { googleMeetPlayback } from "../integrations/google-meet";
import { RevenueError, safeExternalUrl } from "./security";

interface DownloadFile { url: string; content_type: string; file_size_bytes: number; expires_at: string }
interface Download { download_id: string; recording_id: number; status: string; video?: DownloadFile; audio?: DownloadFile }
export async function fathomRecording(callId: string, downloadId?: unknown) {
  const meta = await db.select().from(callMetadata).where(and(eq(callMetadata.orgId, currentTenantId()), eq(callMetadata.callId, callId))).get();
  if (!meta?.connectionId || meta.source !== "fathom" || !/^\d+$/.test(meta.externalId || "")) throw new RevenueError("This call has no Fathom recording.", 404);
  if (downloadId !== undefined && (typeof downloadId !== "string" || !/^dl_[a-zA-Z0-9_-]{1,100}$/.test(downloadId))) throw new RevenueError("Invalid recording request.");
  const connection = await getConnection(meta.connectionId);
  const recording = encodeURIComponent(meta.externalId);
  const result = await fathomRequest<Download>(connection.secrets.token, downloadId ? `/recordings/${recording}/downloads/${encodeURIComponent(String(downloadId))}` : `/recordings/${recording}/download`, downloadId ? undefined : { method: "POST", body: "{}" });
  if (String(result.recording_id) !== meta.externalId || !/^dl_[a-zA-Z0-9_-]{1,100}$/.test(result.download_id || "") || !["processing", "completed", "failed", "expired"].includes(result.status)) throw new RevenueError("Fathom returned an invalid recording response.", 502);
  const file = result.video || result.audio;
  const url = safeExternalUrl(file?.url);
  if (result.status === "completed" && !url) throw new RevenueError("Fathom did not return a usable recording URL.", 502);
  return { downloadId: result.download_id, status: result.status, url, kind: result.video ? "video" : "audio", expiresAt: file?.expires_at };
}

export async function providerRecording(callId: string, downloadId?: unknown) {
  const meta = await db.select().from(callMetadata).where(and(eq(callMetadata.orgId, currentTenantId()), eq(callMetadata.callId, callId))).get();
  if (meta?.source === "zoom") {
    if (downloadId !== undefined) throw new RevenueError("Invalid recording request.");
    if (!meta.connectionId || !meta.externalId) throw new RevenueError("This call has no Zoom recording.", 404);
    const connection = await getConnection(meta.connectionId);
    return zoomPlayback(connection.secrets.token, meta.externalId);
  }
  if (meta?.source === "google-meet") {
    if (downloadId !== undefined) throw new RevenueError("Invalid recording request.");
    if (!meta.connectionId || !meta.externalId) throw new RevenueError("This call has no Google Meet recording.", 404);
    const connection = await getConnection(meta.connectionId);
    return googleMeetPlayback(connection.secrets.token, meta.externalId);
  }
  if (meta?.source === "fathom") return fathomRecording(callId, downloadId);
  throw new RevenueError("This call has no recording.", 404);
}

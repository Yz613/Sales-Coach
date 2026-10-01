import fs from "fs";
import path from "path";
import { fileExtension, mimeTypeForAudio } from "./audio";
import { currentTenantId, LOCAL_TENANT_ID } from "./tenant";
import { revenueRuntime, type RecordingBucket } from "./revenue/runtime";
import { stableId, RevenueError, encryptRecording, decryptRecording } from "./revenue/security";

export const CALL_AUDIO_API_PREFIX = "/api/calls/";

function audioDir(): string {
  return process.env.CALL_AUDIO_DIR || path.resolve(process.cwd(), "data/call-audio");
}

function safeCallId(callId: string): string {
  return (callId || "").replace(/[^a-zA-Z0-9_-]/g, "_");
}

function extFromMime(mimeType: string): string {
  const mime = (mimeType || "").toLowerCase();
  if (mime.includes("mpeg") || mime === "audio/mp3") return ".mp3";
  if (mime.includes("wav")) return ".wav";
  if (mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac")) return ".m4a";
  if (mime.includes("ogg")) return ".ogg";
  if (mime.includes("webm")) return ".webm";
  if (mime.includes("flac")) return ".flac";
  return ".bin";
}

export function callAudioApiPath(callId: string): string {
  return `/api/calls/${encodeURIComponent(callId)}/audio`;
}

export function isStoredCallAudioUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.includes(`${CALL_AUDIO_API_PREFIX}`) && url.endsWith("/audio");
}

export interface StoredCallAudio {
  bytes: Buffer;
  mimeType: string;
  fileName?: string;
}

function recordingBucket(): RecordingBucket | null {
  const runtime = revenueRuntime();
  const bucket = runtime.env.CALL_RECORDINGS as RecordingBucket | undefined;
  if (bucket) return bucket;
  if (runtime.cloudflare) throw new RevenueError("Recording storage is not configured. Bind the CALL_RECORDINGS R2 bucket.", 503);
  return null;
}

function storageKey(callId: string): string {
  return `${stableId(currentTenantId())}/${safeCallId(callId)}`;
}

export async function saveCallAudio(
  callId: string,
  bytes: Uint8Array,
  mimeType?: string | null,
  fileName?: string | null
): Promise<string | undefined> {
  if (!callId || !bytes?.byteLength) return undefined;
  const bucket = recordingBucket();
  const mime = mimeTypeForAudio({ name: fileName || undefined, type: mimeType });
  const encrypted = encryptRecording(bytes, storageKey(callId));
  if (bucket) {
    await bucket.put(storageKey(callId), encrypted, { httpMetadata: { contentType: mime }, customMetadata: { fileName: fileName || "recording" } });
  } else {
    const dir = audioDir();
    const id = storageKey(callId);
    fs.mkdirSync(path.dirname(path.join(dir, id)), { recursive: true, mode: 0o700 });
    const suppliedExtension = fileExtension(fileName);
    const ext = /^\.[a-z0-9]{1,10}$/i.test(suppliedExtension) ? suppliedExtension : extFromMime(mime);
    const dest = path.join(dir, `${id}${ext}`);
    const temporary = `${dest}.${crypto.randomUUID()}.tmp`;
    fs.writeFileSync(temporary, encrypted, { mode: 0o600 });
    fs.renameSync(temporary, dest);
    const metaPath = path.join(dir, `${id}.meta.json`);
    const temporaryMeta = `${metaPath}.${crypto.randomUUID()}.tmp`;
    fs.writeFileSync(temporaryMeta, JSON.stringify({ mimeType: mime, fileName: fileName || "", ext }), { mode: 0o600 });
    fs.renameSync(temporaryMeta, metaPath);
  }
  return callAudioApiPath(callId);
}

export async function readCallAudio(callId: string): Promise<StoredCallAudio | null> {
  if (!callId) return null;
  const bucket = recordingBucket();
  if (bucket) {
    const object = await bucket.get(storageKey(callId));
    return object ? { bytes: decryptRecording(new Uint8Array(await object.arrayBuffer()), storageKey(callId)), mimeType: object.httpMetadata?.contentType || "application/octet-stream", fileName: object.customMetadata?.fileName } : null;
  }
  try {
    const dir = audioDir();
    const scoped = storageKey(callId);
    const legacyAllowed = currentTenantId() === LOCAL_TENANT_ID || currentTenantId() === process.env.LEGACY_TENANT_ORG_ID;
    const id = fs.existsSync(path.join(dir, `${scoped}.meta.json`)) ? scoped : legacyAllowed ? safeCallId(callId) : scoped;
    const metaPath = path.join(dir, `${id}.meta.json`);
    if (!fs.existsSync(metaPath)) {
      if (legacyAllowed && /^call_0[1-4]$/.test(callId)) {
        const fixture = path.resolve(process.cwd(), "fixtures/recordings", `${callId}.mp3`);
        if (fs.existsSync(fixture)) return { bytes: fs.readFileSync(fixture), mimeType: "audio/mpeg", fileName: `${callId}.mp3` };
      }
      return null;
    }
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8")) as {
      mimeType?: string;
      fileName?: string;
      ext?: string;
    };
    const ext = meta.ext || fileExtension(meta.fileName) || ".bin";
    if (!/^\.[a-z0-9]+$/i.test(ext)) return null;
    const dest = path.join(dir, `${id}${ext}`);
    if (!fs.existsSync(dest)) return null;
    return {
      bytes: decryptRecording(fs.readFileSync(dest), storageKey(callId)),
      mimeType: meta.mimeType || mimeTypeForAudio({ name: meta.fileName, type: "" }),
      fileName: meta.fileName,
    };
  } catch {
    return null;
  }
}

export async function deleteCallAudio(callId: string): Promise<void> {
  const bucket = recordingBucket();
  if (bucket) { await bucket.delete(storageKey(callId)); return; }
  const legacyAllowed = currentTenantId() === LOCAL_TENANT_ID || currentTenantId() === process.env.LEGACY_TENANT_ORG_ID;
  for (const id of [storageKey(callId), ...(legacyAllowed ? [safeCallId(callId)] : [])]) {
    const metaPath = path.join(audioDir(), `${id}.meta.json`);
    if (!fs.existsSync(metaPath)) continue;
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    const ext = typeof meta.ext === "string" && /^\.[a-z0-9]+$/i.test(meta.ext) ? meta.ext : ".bin";
    fs.rmSync(path.join(audioDir(), `${id}${ext}`), { force: true });
    fs.rmSync(metaPath, { force: true });
  }
}

/** Remove an unscoped plaintext copy only after an operator has migrated the authenticated tenant's recording. */
export function removeLegacyCallAudio(callId: string): void {
  if (currentTenantId() !== LOCAL_TENANT_ID && currentTenantId() !== process.env.LEGACY_TENANT_ORG_ID) return;
  const id = safeCallId(callId);
  const metaPath = path.join(audioDir(), `${id}.meta.json`);
  if (!fs.existsSync(metaPath)) return;
  const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  const ext = typeof meta.ext === "string" && /^\.[a-z0-9]+$/i.test(meta.ext) ? meta.ext : ".bin";
  fs.rmSync(path.join(audioDir(), `${id}${ext}`), { force: true });
  fs.rmSync(metaPath, { force: true });
}

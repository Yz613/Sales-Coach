import fs from "fs";
import path from "path";
import { fileExtension, mimeTypeForAudio } from "./audio";

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

export function saveCallAudio(
  callId: string,
  bytes: Uint8Array,
  mimeType?: string | null,
  fileName?: string | null
): string | undefined {
  if (!callId || !bytes?.byteLength) return undefined;
  try {
    const dir = audioDir();
    fs.mkdirSync(dir, { recursive: true });
    const id = safeCallId(callId);
    const mime = mimeTypeForAudio({ name: fileName || undefined, type: mimeType });
    const ext = fileExtension(fileName) || extFromMime(mime);
    const dest = path.join(dir, `${id}${ext}`);
    fs.writeFileSync(dest, bytes);
    fs.writeFileSync(
      path.join(dir, `${id}.meta.json`),
      JSON.stringify({ mimeType: mime, fileName: fileName || "", ext })
    );
    return callAudioApiPath(callId);
  } catch (err) {
    console.warn("Could not persist call audio:", err);
    return undefined;
  }
}

export function readCallAudio(callId: string): StoredCallAudio | null {
  if (!callId) return null;
  try {
    const dir = audioDir();
    const id = safeCallId(callId);
    const metaPath = path.join(dir, `${id}.meta.json`);
    if (!fs.existsSync(metaPath)) return null;
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8")) as {
      mimeType?: string;
      fileName?: string;
      ext?: string;
    };
    const dest = path.join(dir, `${id}${meta.ext || fileExtension(meta.fileName) || ".bin"}`);
    if (!fs.existsSync(dest)) return null;
    return {
      bytes: fs.readFileSync(dest),
      mimeType: meta.mimeType || mimeTypeForAudio({ name: meta.fileName, type: "" }),
      fileName: meta.fileName,
    };
  } catch {
    return null;
  }
}

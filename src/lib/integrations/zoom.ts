import { and, eq } from "drizzle-orm";
import { ProviderError, providerList, providerRequest } from "./http";
import { externalParticipants, normalizedMeeting } from "./meeting";
import { saveCallAudio } from "../callAudioStore";
import { db } from "../db";
import { calls } from "../db/schema";
import { currentTenantId } from "../tenant";
import { RevenueError, safeExternalUrl } from "../revenue/security";
import type { ConnectionConfig, ImportedMeeting, Segment, SyncCursor } from "../revenue/types";

const API = "https://api.zoom.us";
const DAY = 86400000;
const WINDOW_SPAN = 29 * DAY;
const WINDOW_CURSOR = "zoom-window:";
const AUDIO_LIMIT = 20 * 1024 * 1024;
const TRANSCRIPT_LIMIT = 2 * 1024 * 1024;
const MEDIA_TYPES = new Set(["MP4", "M4A", "TRANSCRIPT"]);

type Secrets = Record<string, string>;

export function zoomHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "zoom.us" || host.endsWith(".zoom.us");
}

/** Meeting UUIDs that start with / or contain // must be double-encoded. */
export function zoomPathId(id: string): string {
  if (id.startsWith("/") || id.includes("//")) return encodeURIComponent(encodeURIComponent(id));
  return encodeURIComponent(id);
}

function zoomRequest<T>(token: string, path: string): Promise<T> {
  return providerRequest<T>("Zoom", API, path, { Authorization: `Bearer ${token}` });
}

function ymd(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function pageToken(after?: string): string | undefined {
  return after && !after.startsWith(WINDOW_CURSOR) ? after : undefined;
}

function publicZoomUrl(value: unknown): string | null {
  const safe = safeExternalUrl(value);
  if (!safe) return null;
  const url = new URL(safe);
  if (!zoomHost(url.hostname)) return null;
  url.searchParams.delete("access_token");
  return url.toString();
}

function publicHttps(url: URL): boolean {
  if (url.protocol !== "https:" || url.username || url.password || url.hostname === "localhost" || url.hostname.endsWith(".local")) return false;
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(url.hostname) || url.hostname.includes(":")) return false;
  return url.hostname.includes(".");
}

/** OAuth bearer stays on Zoom. Later hops can be a signed HTTPS file URL. */
export async function zoomDownload(token: string, start: string, maxBytes: number, accept: string): Promise<Uint8Array> {
  let current = start;
  let sendBearer = true;
  for (let hop = 0; hop < 3; hop++) {
    const url = new URL(current);
    if (!publicHttps(url) || (sendBearer && !zoomHost(url.hostname))) throw new RevenueError("Zoom returned an invalid download address.", 502);
    const response = await fetch(url, {
      headers: { Accept: accept, ...(sendBearer ? { Authorization: `Bearer ${token}` } : {}) },
      redirect: "manual", signal: AbortSignal.timeout(25000), cache: "no-store",
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new ProviderError("Zoom", response.status);
      const next = new URL(location, url);
      sendBearer = zoomHost(next.hostname);
      current = next.toString();
      continue;
    }
    if (!response.ok) {
      const retry = Number(response.headers.get("retry-after"));
      throw new ProviderError("Zoom", response.status, Number.isFinite(retry) ? Math.min(3600, retry) : 0);
    }
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > maxBytes) throw new RevenueError("Zoom recording is too large to copy.", 413);
    const reader = response.body?.getReader();
    if (!reader) {
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > maxBytes) throw new RevenueError("Zoom recording is too large to copy.", 413);
      return bytes;
    }
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > maxBytes) { await reader.cancel(); throw new RevenueError("Zoom recording is too large to copy.", 413); }
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return bytes;
  }
  throw new RevenueError("Zoom download redirected too many times.", 502);
}

export function parseZoomTranscript(vtt: string): Segment[] {
  const time = /(\d{2}):(\d{2}):(\d{2})[.,](\d{3})\s+-->\s+(\d{2}):(\d{2}):(\d{2})[.,](\d{3})/;
  const seconds = (h: string, m: string, s: string, ms: string) => Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000;
  const segments: Segment[] = [];
  for (const block of vtt.replace(/^\uFEFF/, "").replace(/\r/g, "").split(/\n{2,}/)) {
    const lines = block.split("\n").map(line => line.trim()).filter(Boolean);
    const index = lines.findIndex(line => time.test(line));
    if (index < 0) continue;
    const match = lines[index].match(time)!;
    const cue = lines.slice(index + 1).join(" ").trim();
    if (!cue || /^NOTE\b/i.test(cue)) continue;
    const voice = cue.match(/^<v(?:\.[^ >]+)?\s+([^>]+)>([\s\S]*?)(?:<\/v>)?$/i);
    let speaker = "Unknown";
    let text = cue.replace(/<[^>]+>/g, "").trim();
    if (voice) { speaker = voice[1].trim(); text = voice[2].replace(/<[^>]+>/g, "").trim(); }
    else {
      const named = text.match(/^([^:]{1,80}):\s+([\s\S]+)$/);
      if (named) { speaker = named[1].trim(); text = named[2].trim(); }
    }
    if (!text) continue;
    segments.push({ speaker: speaker.slice(0, 200), text, start: seconds(match[1], match[2], match[3], match[4]), end: seconds(match[5], match[6], match[7], match[8]), timing: "provider" });
  }
  return segments;
}

async function zoomUser(token: string): Promise<{ email: string; name: string }> {
  const user = await zoomRequest<any>(token, "/v2/users/me");
  const email = typeof user.email === "string" ? user.email.trim() : "";
  const name = [user.first_name, user.last_name].filter((part: unknown) => typeof part === "string" && part.trim()).join(" ") || String(user.display_name || email.split("@")[0] || "Sales Rep");
  if (!email.includes("@")) throw new RevenueError("Zoom returned an invalid user account.", 502);
  return { email, name: name.slice(0, 200) };
}

export async function verifyZoom(token: string): Promise<Partial<ConnectionConfig>> {
  const user = await zoomUser(token);
  const end = Date.now();
  await zoomRequest(token, `/v2/users/me/recordings?${new URLSearchParams({ from: ymd(end - DAY), to: ymd(end), page_size: "1" })}`);
  return { accountEmail: user.email, accountName: user.name };
}

function completedMedia(meeting: any): boolean {
  return (Array.isArray(meeting?.recording_files) ? meeting.recording_files : []).some((file: any) => file?.status === "completed" && MEDIA_TYPES.has(String(file.file_type || "").toUpperCase()));
}

function bounds(state: SyncCursor): { end: number; floor: number } {
  const end = Date.parse(state.syncStartedAt || new Date().toISOString());
  const floor = state.createdAfter ? Date.parse(state.createdAfter) : end - (state.full ? 730 : 180) * DAY;
  if (!Number.isFinite(end) || !Number.isFinite(floor)) throw new RevenueError("Invalid Zoom sync window.");
  return { end, floor: Math.min(floor, end) };
}

/** Zoom allows about one month per list request, so history walks backward in 30-day windows. */
export async function zoomPage(secrets: Secrets, state: SyncCursor): Promise<{ deferred: any[]; next: SyncCursor }> {
  const { end, floor } = bounds(state);
  const windowEnd = state.windowEnd ? Date.parse(state.windowEnd) : end;
  const windowStart = state.windowStart ? Date.parse(state.windowStart) : Math.max(floor, windowEnd - WINDOW_SPAN);
  if (!Number.isFinite(windowEnd) || !Number.isFinite(windowStart) || windowEnd < floor) return { deferred: [], next: { ...state, complete: true } };
  const host = state.hostEmail ? { email: state.hostEmail, name: state.hostName || "Sales Rep" } : await zoomUser(secrets.token);
  const query = new URLSearchParams({ from: ymd(windowStart), to: ymd(windowEnd), page_size: "30" });
  const token = pageToken(state.after);
  if (token) query.set("next_page_token", token);
  const response = await zoomRequest<any>(secrets.token, `/v2/users/me/recordings?${query}`);
  const meetings = providerList(response.meetings, "Zoom", response.total_records === 0).filter(completedMedia);
  const deferred = meetings.map(meeting => ({
    id: String(meeting.uuid || ""), meetingId: meeting.id, topic: meeting.topic, start_time: meeting.start_time, duration: meeting.duration,
    share_url: publicZoomUrl(meeting.share_url), hostEmail: host.email, hostName: host.name,
  })).filter(meeting => meeting.id && meeting.id.length <= 200);
  const nextWindow = response.next_page_token
    ? { windowStart: new Date(windowStart).toISOString(), windowEnd: new Date(windowEnd).toISOString(), after: String(response.next_page_token), complete: false }
    : windowStart <= floor
      ? { windowStart: new Date(windowStart).toISOString(), windowEnd: new Date(windowEnd).toISOString(), after: undefined, complete: true }
      : (() => {
        const nextEnd = windowStart - DAY; const nextStart = Math.max(floor, nextEnd - WINDOW_SPAN);
        return { windowStart: new Date(nextStart).toISOString(), windowEnd: new Date(nextEnd).toISOString(), after: `${WINDOW_CURSOR}${new Date(nextStart).toISOString()}`, complete: false };
      })();
  return { deferred, next: { ...state, hostEmail: host.email, hostName: host.name, ...nextWindow } };
}

async function recordingDetail(token: string, uuid: string): Promise<any> {
  return zoomRequest(token, `/v2/meetings/${zoomPathId(uuid)}/recordings?include_fields=download_access_token`);
}

async function participants(token: string, uuid: string): Promise<{ name: string; email?: string }[]> {
  const people: { name: string; email?: string }[] = [];
  let cursor = "";
  for (let page = 0; page < 5; page++) {
    const query = new URLSearchParams({ page_size: "300" });
    if (cursor) query.set("next_page_token", cursor);
    try {
      const result = await zoomRequest<any>(token, `/v2/past_meetings/${zoomPathId(uuid)}/participants?${query}`);
      for (const person of providerList(result.participants, "Zoom", true)) people.push({ name: String(person.name || person.user_email || "Participant"), email: typeof person.user_email === "string" ? person.user_email : undefined });
      cursor = result.next_page_token || "";
      if (!cursor) break;
    } catch (error) {
      if (error instanceof ProviderError && [400, 403, 404].includes(error.providerStatus)) break;
      throw error;
    }
  }
  return people;
}

async function transcriptText(token: string, uuid: string, detail: any): Promise<string | null> {
  const files = Array.isArray(detail?.recording_files) ? detail.recording_files : [];
  const file = files.find((item: any) => String(item.file_type || "").toUpperCase() === "TRANSCRIPT" && item.status === "completed" && publicZoomUrl(item.download_url));
  const candidates = [file?.download_url, `${API}/v2/meetings/${zoomPathId(uuid)}/transcript`].filter(Boolean);
  for (const target of candidates) {
    try {
      const bytes = await zoomDownload(token, String(target), TRANSCRIPT_LIMIT, "text/vtt, text/plain, application/json");
      const text = new TextDecoder().decode(bytes);
      if (/-->|WEBVTT/i.test(text)) return text;
      if (text.trim().startsWith("{")) {
        try {
          const nested = publicZoomUrl(JSON.parse(text).download_url);
          if (nested) {
            const nestedText = new TextDecoder().decode(await zoomDownload(token, nested, TRANSCRIPT_LIMIT, "text/vtt, text/plain"));
            if (/-->|WEBVTT/i.test(nestedText)) return nestedText;
          }
        } catch (error) { if (error instanceof ProviderError || error instanceof RevenueError) throw error; }
      }
    } catch (error) {
      if (error instanceof ProviderError && [400, 401, 403, 404].includes(error.providerStatus)) continue;
      if (error instanceof RevenueError && error.status === 413) continue;
      throw error;
    }
  }
  return null;
}

function playbackFile(files: any[]): any | undefined {
  const completed = files.filter(file => file?.status === "completed");
  return completed.find(file => String(file.file_type).toUpperCase() === "M4A" && publicZoomUrl(file.download_url))
    || completed.find(file => String(file.recording_type || "").includes("audio") && publicZoomUrl(file.download_url))
    || completed.find(file => String(file.file_type).toUpperCase() === "MP4" && publicZoomUrl(file.download_url));
}

export async function fetchZoomCall(secrets: Secrets, raw: any): Promise<ImportedMeeting | null> {
  const uuid = String(raw?.id || "");
  if (!uuid || uuid.length > 200) throw new RevenueError("Zoom recording is missing a meeting id.");
  const detail = raw.recording_files ? raw : await recordingDetail(secrets.token, uuid);
  let vtt: string | null;
  try { vtt = await transcriptText(secrets.token, uuid, detail); }
  catch (error) { if (error instanceof ProviderError && [400, 401, 403, 404].includes(error.providerStatus)) return null; throw error; }
  if (!vtt) return null;
  const segments = parseZoomTranscript(vtt);
  if (!segments.length) return null;
  const host = raw.hostEmail ? { email: String(raw.hostEmail), name: String(raw.hostName || "Sales Rep") } : await zoomUser(secrets.token);
  const people = await participants(secrets.token, uuid);
  const listed = externalParticipants(people.map(person => ({ name: person.name, email: person.email || "" })), host.email);
  const known = new Set(listed.map(person => person.name.toLowerCase()));
  for (const segment of segments) {
    if (known.has(segment.speaker.toLowerCase())) continue;
    listed.push({ name: segment.speaker, external: segment.speaker.toLowerCase() !== host.name.toLowerCase() });
    known.add(segment.speaker.toLowerCase());
  }
  if (!listed.some(person => person.email?.toLowerCase() === host.email.toLowerCase())) listed.unshift({ name: host.name, email: host.email, external: false });
  const prospect = listed.find(person => person.external);
  return normalizedMeeting({
    externalId: uuid, title: String(detail.topic || raw.topic || "Zoom meeting"), repName: host.name, repEmail: host.email,
    participants: listed, prospectName: prospect?.name, prospectCompany: prospect?.email?.split("@")[1] || "",
    createdAt: detail.start_time || raw.start_time, durationSeconds: Number(detail.duration || raw.duration) * 60 || undefined,
    recordingPageUrl: publicZoomUrl(detail.share_url || raw.share_url), segments,
  });
}

function storedAudioFile(files: any[]): any | undefined {
  const completed = (Array.isArray(files) ? files : []).filter(file => file?.status === "completed" && publicZoomUrl(file.download_url));
  return completed.find(file => String(file.file_type).toUpperCase() === "M4A")
    || completed.find(file => String(file.recording_type || "") === "audio_only");
}

/** Copy a small audio file into the existing recording store when it fits. Playback still works without it. */
export async function maybeStoreZoomAudio(secrets: Secrets, callId: string, uuid: string): Promise<boolean> {
  const existing = await db.select({ audioUrl: calls.audioUrl }).from(calls).where(and(eq(calls.id, callId), eq(calls.orgId, currentTenantId()))).get();
  if (existing?.audioUrl) return false;
  const detail = await recordingDetail(secrets.token, uuid);
  const file = storedAudioFile(detail.recording_files);
  if (!file || (Number(file.file_size) > AUDIO_LIMIT)) return false;
  let bytes: Uint8Array;
  try { bytes = await zoomDownload(secrets.token, String(file.download_url), AUDIO_LIMIT, "audio/mp4, audio/mpeg"); }
  catch (error) { if (error instanceof RevenueError && error.status === 413) return false; throw error; }
  const audioUrl = await saveCallAudio(callId, bytes, "audio/mp4", "zoom-recording.m4a");
  if (!audioUrl) return false;
  await db.update(calls).set({ audioUrl }).where(and(eq(calls.id, callId), eq(calls.orgId, currentTenantId()))).run();
  return true;
}

/** Short-lived Zoom playback URL. The download token is not stored. */
export async function zoomPlayback(token: string, uuid: string) {
  const detail = await recordingDetail(token, uuid);
  const file = playbackFile(detail.recording_files || []);
  const downloadToken = typeof detail.download_access_token === "string" ? detail.download_access_token : "";
  if (!file || !downloadToken || downloadToken.length > 4096 || /\s/.test(downloadToken)) throw new RevenueError("Zoom did not return a usable recording link.", 502);
  const url = new URL(String(file.download_url));
  url.searchParams.set("access_token", downloadToken);
  const playback = safeExternalUrl(url.toString());
  if (!playback || !zoomHost(new URL(playback).hostname)) throw new RevenueError("Zoom did not return a usable recording link.", 502);
  const audio = String(file.file_type).toUpperCase() === "M4A" || String(file.recording_type || "").includes("audio");
  return { downloadId: "zoom", status: "completed", url: playback, kind: audio ? "audio" : "video" as const };
}

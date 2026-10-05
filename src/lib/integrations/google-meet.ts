import { and, eq } from "drizzle-orm";
import { ProviderError, providerFailureDetail, providerList, providerRequest, redactProviderBody } from "./http";
import { externalParticipants, normalizedMeeting } from "./meeting";
import { saveCallAudio } from "../callAudioStore";
import { db } from "../db";
import { calls } from "../db/schema";
import { currentTenantId } from "../tenant";
import { RevenueError, safeExternalUrl } from "../revenue/security";
import type { ImportedMeeting, Segment, SyncCursor } from "../revenue/types";

const MEET = "https://meet.googleapis.com";
const GOOGLE = "https://www.googleapis.com";
const PEOPLE = "https://people.googleapis.com";
const DAY = 86400000;
const HISTORY_MS = 30 * DAY;
const TRANSCRIPT_RETRY_MS = 6 * 60 * 60 * 1000;
const AUDIO_LIMIT = 20 * 1024 * 1024;
const MISSING_TRANSCRIPT = "Transcript entries were not available from Google Meet. Entries expire 30 days after the meeting.";

type Secrets = Record<string, string>;
type MeetRecord = { name?: string; startTime?: string; endTime?: string; space?: string };
type MeetParticipant = {
  name?: string;
  signedinUser?: { user?: string; displayName?: string };
  anonymousUser?: { displayName?: string };
  phoneUser?: { displayName?: string };
};
type MeetTranscript = { name?: string; state?: string; docsDestination?: { document?: string; exportUri?: string } };
type MeetEntry = { participant?: string; text?: string; startTime?: string; endTime?: string };
type MeetRecording = { state?: string; driveDestination?: { file?: string; exportUri?: string } };
type DriveFile = { mimeType?: string; size?: string; webViewLink?: string; name?: string };

function meetRequest<T>(token: string, path: string): Promise<T> {
  return providerRequest<T>("Google Meet", MEET, path, { Authorization: `Bearer ${token}` });
}

function googleRequest<T>(token: string, path: string): Promise<T> {
  return providerRequest<T>("Google Meet", GOOGLE, path, { Authorization: `Bearer ${token}` });
}

export function conferenceId(name: string): string {
  const prefix = "conferenceRecords/";
  return name.startsWith(prefix) ? name.slice(prefix.length) : name;
}

function pageQuery(pageToken?: string, filter?: string): string {
  const query = new URLSearchParams({ pageSize: "100" });
  if (pageToken) query.set("pageToken", pageToken);
  if (filter) query.set("filter", filter);
  return query.toString();
}

async function listField<T>(token: string, path: string, field: string): Promise<T[]> {
  const items: T[] = [];
  let pageToken = "";
  for (let page = 0; page < 20; page++) {
    const joiner = path.includes("?") ? "&" : "?";
    const body = await meetRequest<Record<string, unknown>>(token, `${path}${joiner}${pageQuery(pageToken || undefined)}`);
    items.push(...providerList(body[field], "Google Meet", true) as T[]);
    pageToken = typeof body.nextPageToken === "string" ? body.nextPageToken : "";
    if (!pageToken) break;
  }
  return items;
}

async function optionalList<T>(token: string, path: string, field: string): Promise<T[]> {
  try {
    return await listField<T>(token, path, field);
  } catch (error) {
    if (error instanceof ProviderError && error.providerStatus === 404) return [];
    throw error;
  }
}

function googleApiHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "www.googleapis.com" || host === "googleapis.com" || host === "drive.google.com" || host === "docs.google.com" || host.endsWith(".googleusercontent.com");
}

function publicDriveUrl(value: unknown): string | null {
  const safe = safeExternalUrl(value);
  if (!safe) return null;
  const url = new URL(safe);
  if (!googleApiHost(url.hostname)) return null;
  url.searchParams.delete("access_token");
  return url.toString();
}

/** Drive file ids from a Meet recording destination. Full Drive URLs stay on drive.google.com. */
export function driveFileId(value: unknown): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const fromUrl = raw.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fromUrl) return fromUrl[1];
  const id = raw.replace(/^files\//, "");
  return /^[a-zA-Z0-9_-]{10,}$/.test(id) ? id : null;
}

function secondsBetween(origin: string, point?: string): number {
  const start = Date.parse(origin);
  const value = point ? Date.parse(point) : NaN;
  if (!Number.isFinite(start) || !Number.isFinite(value)) return 0;
  return Math.max(0, (value - start) / 1000);
}

async function accountProfile(token: string): Promise<{ email: string; name: string }> {
  const profile = await googleRequest<{ email?: string; name?: string }>(token, "/oauth2/v2/userinfo");
  const email = String(profile.email || "");
  return { email, name: String(profile.name || email.split("@")[0] || "Sales Rep") };
}

async function participantEmail(token: string, userResource: string): Promise<string> {
  const id = userResource.replace(/^users\//, "");
  if (!id || id.length > 200) return "";
  try {
    const person = await providerRequest<{ emailAddresses?: { value?: string }[] }>("Google Meet", PEOPLE, `/v1/people/${encodeURIComponent(id)}?personFields=emailAddresses`, { Authorization: `Bearer ${token}` });
    return String(person.emailAddresses?.find(entry => entry.value)?.value || "");
  } catch (error) {
    if (error instanceof ProviderError && [403, 404].includes(error.providerStatus)) return "";
    throw error;
  }
}

function displayName(person: MeetParticipant): string {
  return person.signedinUser?.displayName || person.anonymousUser?.displayName || person.phoneUser?.displayName || "Participant";
}

export async function verifyGoogleMeet(token: string) {
  const profile = await accountProfile(token);
  const end = new Date();
  const start = new Date(end.getTime() - DAY);
  const filter = `start_time>="${start.toISOString()}" AND end_time<="${end.toISOString()}"`;
  await meetRequest(token, `/v2/conferenceRecords?${pageQuery(undefined, filter)}`);
  return { accountEmail: profile.email, accountName: profile.name };
}

export async function googleMeetPage(secrets: Secrets, state: SyncCursor): Promise<{ deferred: any[]; next: SyncCursor }> {
  const end = Date.parse(state.syncStartedAt || "") || Date.now();
  const floor = end - HISTORY_MS;
  const requested = state.createdAfter ? Date.parse(state.createdAfter) : floor;
  const start = Math.max(floor, Number.isFinite(requested) ? requested : floor);
  const host = state.hostEmail ? { email: state.hostEmail, name: state.hostName || "Sales Rep" } : await accountProfile(secrets.token);
  const filter = `start_time>="${new Date(start).toISOString()}" AND end_time<="${new Date(end).toISOString()}"`;
  const pageToken = state.after && !state.after.startsWith("google-meet:") ? state.after : "";
  const body = await meetRequest<{ conferenceRecords?: MeetRecord[]; nextPageToken?: string }>(secrets.token, `/v2/conferenceRecords?${pageQuery(pageToken || undefined, filter)}`);
  const records = providerList(body.conferenceRecords, "Google Meet", true) as MeetRecord[];
  const deferred = records.filter(record => record.name && record.endTime).map(record => ({
    id: conferenceId(String(record.name)),
    name: record.name,
    startTime: record.startTime,
    endTime: record.endTime,
    hostEmail: host.email,
    hostName: host.name,
  }));
  return {
    deferred,
    next: { ...state, hostEmail: host.email, hostName: host.name, after: body.nextPageToken || undefined, complete: !body.nextPageToken },
  };
}

async function transcriptEntries(token: string, transcriptName: string): Promise<MeetEntry[]> {
  return optionalList<MeetEntry>(token, `/v2/${transcriptName}/entries`, "transcriptEntries");
}

function recordingFile(recordings: MeetRecording[]): string | null {
  const ready = recordings.find(recording => recording.state === "FILE_GENERATED" || !recording.state);
  return driveFileId(ready?.driveDestination?.file) || driveFileId(ready?.driveDestination?.exportUri);
}

export async function fetchGoogleMeetCall(secrets: Secrets, raw: any): Promise<ImportedMeeting | null> {
  const id = conferenceId(String(raw?.name || raw?.id || ""));
  if (!id) return null;
  const parent = `conferenceRecords/${id}`;
  const record = raw?.endTime ? raw as MeetRecord : await meetRequest<MeetRecord>(secrets.token, `/v2/${parent}`);
  if (!record.endTime) return null;
  const startTime = String(record.startTime || raw.startTime || record.endTime);
  const [people, transcripts, recordings] = await Promise.all([
    optionalList<MeetParticipant>(secrets.token, `/v2/${parent}/participants`, "participants"),
    optionalList<MeetTranscript>(secrets.token, `/v2/${parent}/transcripts`, "transcripts"),
    optionalList<MeetRecording>(secrets.token, `/v2/${parent}/recordings`, "recordings"),
  ]);
  const emails = new Map<string, string>();
  for (const person of people) {
    const user = person.signedinUser?.user;
    if (!user || !person.name) continue;
    const email = await participantEmail(secrets.token, user);
    if (email) emails.set(person.name, email);
  }
  const host = raw.hostEmail ? { email: String(raw.hostEmail), name: String(raw.hostName || "Sales Rep") } : await accountProfile(secrets.token);
  const names = new Map(people.filter(person => person.name).map(person => [person.name as string, displayName(person)]));
  const entries: MeetEntry[] = [];
  for (const transcript of transcripts) {
    if (!transcript.name || transcript.state === "STARTED") continue;
    entries.push(...await transcriptEntries(secrets.token, transcript.name));
  }
  const segments: Segment[] = entries.filter(entry => entry.text?.trim()).map(entry => {
    const speaker = (entry.participant && names.get(entry.participant)) || "Participant";
    return {
      speaker,
      email: entry.participant ? emails.get(entry.participant) : undefined,
      text: String(entry.text),
      start: secondsBetween(startTime, entry.startTime),
      end: entry.endTime ? secondsBetween(startTime, entry.endTime) : undefined,
      timing: "provider" as const,
    };
  });
  const endedAt = Date.parse(record.endTime);
  const stillProcessing = transcripts.some(transcript => transcript.state === "STARTED") || (!segments.length && Number.isFinite(endedAt) && Date.now() - endedAt < TRANSCRIPT_RETRY_MS);
  if (!segments.length && stillProcessing) return null;
  if (!segments.length) {
    segments.push({ speaker: "System", text: MISSING_TRANSCRIPT, start: 0, end: 1, timing: "provider" });
  }
  const listed = externalParticipants(people.map(person => ({
    name: displayName(person),
    email: person.name ? emails.get(person.name) || "" : "",
  })), host.email);
  if (host.email && !listed.some(person => person.email?.toLowerCase() === host.email.toLowerCase())) {
    listed.unshift({ name: host.name, email: host.email, external: false });
  }
  const prospect = listed.find(person => person.external);
  const fileId = recordingFile(recordings);
  const driveLink = recordings.map(recording => publicDriveUrl(recording.driveDestination?.exportUri)).find(Boolean)
    || (fileId ? `https://drive.google.com/file/d/${fileId}/view` : null);
  const duration = Math.max(1, Math.round((Date.parse(record.endTime) - Date.parse(startTime)) / 1000) || 0);
  return normalizedMeeting({
    externalId: id,
    title: prospect?.name ? `Google Meet · ${prospect.name}` : "Google Meet",
    repName: host.name,
    repEmail: host.email,
    participants: listed,
    prospectName: prospect?.name,
    prospectCompany: prospect?.email?.split("@")[1] || "",
    createdAt: startTime,
    durationSeconds: duration,
    recordingPageUrl: driveLink,
    segments,
  });
}

async function driveMeta(token: string, fileId: string): Promise<DriveFile> {
  return googleRequest<DriveFile>(token, `/drive/v3/files/${encodeURIComponent(fileId)}?fields=mimeType,size,webViewLink,name`);
}

/** Download a Meet Drive file. The OAuth bearer stays on googleapis.com. */
export async function googleMeetDownload(token: string, start: string, maxBytes: number): Promise<{ bytes: Uint8Array; mimeType: string }> {
  let current = start;
  let sendBearer = true;
  for (let hop = 0; hop < 3; hop++) {
    const url = new URL(current);
    if (url.protocol !== "https:" || url.username || url.password) throw new RevenueError("Google Meet returned an invalid download address.", 502);
    if (sendBearer && url.hostname !== "www.googleapis.com") throw new RevenueError("Google Meet returned an invalid download address.", 502);
    if (!sendBearer && !googleApiHost(url.hostname)) throw new RevenueError("Google Meet returned an invalid download address.", 502);
    const response: Response = await fetch(url, {
      headers: sendBearer ? { Authorization: `Bearer ${token}` } : {},
      redirect: "manual", signal: AbortSignal.timeout(25000), cache: "no-store",
    });
    if (response.status >= 300 && response.status < 400) {
      const location: string | null = response.headers.get("location");
      if (!location) throw new ProviderError("Google Meet", response.status);
      const next: URL = new URL(location, url);
      sendBearer = next.hostname === "www.googleapis.com";
      current = next.toString();
      continue;
    }
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error("Google Meet request failed", response.status, redactProviderBody(body));
      throw new ProviderError("Google Meet", response.status, 0, providerFailureDetail(body));
    }
    const length = Number(response.headers.get("content-length"));
    if (Number.isFinite(length) && length > maxBytes) throw new RevenueError("Recording is larger than the local store limit.", 413);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > maxBytes) throw new RevenueError("Recording is larger than the local store limit.", 413);
    const mimeType = (response.headers.get("content-type") || "video/mp4").split(";")[0].trim();
    return { bytes, mimeType };
  }
  throw new RevenueError("Google Meet returned an invalid download address.", 502);
}

export async function maybeStoreGoogleMeetAudio(secrets: Secrets, callId: string, conferenceIdValue: string): Promise<boolean> {
  const existing = await db.select({ audioUrl: calls.audioUrl }).from(calls).where(and(eq(calls.id, callId), eq(calls.orgId, currentTenantId()))).get();
  if (existing?.audioUrl) return false;
  const recordings = await optionalList<MeetRecording>(secrets.token, `/v2/conferenceRecords/${encodeURIComponent(conferenceIdValue)}/recordings`, "recordings");
  const fileId = recordingFile(recordings);
  if (!fileId) return false;
  const meta = await driveMeta(secrets.token, fileId);
  if (Number(meta.size) > AUDIO_LIMIT) return false;
  let downloaded: { bytes: Uint8Array; mimeType: string };
  try {
    downloaded = await googleMeetDownload(secrets.token, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, AUDIO_LIMIT);
  } catch (error) {
    if (error instanceof RevenueError && error.status === 413) return false;
    throw error;
  }
  const mime = downloaded.mimeType.startsWith("audio/") || downloaded.mimeType === "video/mp4" || downloaded.mimeType === "video/webm" ? downloaded.mimeType : "video/mp4";
  const audioUrl = await saveCallAudio(callId, downloaded.bytes, mime, "google-meet-recording.mp4");
  if (!audioUrl) return false;
  await db.update(calls).set({ audioUrl }).where(and(eq(calls.id, callId), eq(calls.orgId, currentTenantId()))).run();
  return true;
}

export async function googleMeetPlayback(token: string, conferenceIdValue: string) {
  const recordings = await optionalList<MeetRecording>(token, `/v2/conferenceRecords/${encodeURIComponent(conferenceIdValue)}/recordings`, "recordings");
  const fileId = recordingFile(recordings);
  if (!fileId) throw new RevenueError("This call has no Google Meet recording.", 404);
  const meta = await driveMeta(token, fileId);
  const url = publicDriveUrl(meta.webViewLink) || `https://drive.google.com/file/d/${fileId}/view`;
  return { downloadId: "google-meet", status: "completed" as const, url, kind: "video" as const };
}

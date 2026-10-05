import { and, eq } from "drizzle-orm";
import { ProviderError, providerFailureDetail, providerList, providerRequest, redactProviderBody } from "./http";
import { externalParticipants, normalizedMeeting } from "./meeting";
import { parseZoomTranscript } from "./zoom";
import { saveCallAudio } from "../callAudioStore";
import { db } from "../db";
import { calls } from "../db/schema";
import { currentTenantId } from "../tenant";
import { RevenueError, safeExternalUrl } from "../revenue/security";
import type { ConnectionConfig, ImportedMeeting, SyncCursor } from "../revenue/types";

const GRAPH = "https://graph.microsoft.com";
const DAY = 86400000;
const WINDOW_DAYS = 30;
const AUDIO_LIMIT = 20 * 1024 * 1024;
const TRANSCRIPT_LIMIT = 2 * 1024 * 1024;
const ID_LIMIT = 1000;
const CONSUMER_DOMAINS = new Set(["outlook.com", "hotmail.com", "live.com", "msn.com"]);
const USER_ID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

type Secrets = Record<string, string>;
type Person = { name: string; email: string };

export function teamsHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "teams.microsoft.com" || host.endsWith(".teams.microsoft.com") || host === "teams.live.com" || host.endsWith(".teams.live.com");
}

/** Meeting ids can contain /, +, and =. A slash must be double-encoded so it stays one path segment. */
export function teamsPathId(id: string): string {
  const once = encodeURIComponent(id);
  return id.includes("/") ? encodeURIComponent(once) : once;
}

function graphRequest<T>(token: string, path: string): Promise<T> {
  return providerRequest<T>("Microsoft Teams", GRAPH, path, { Authorization: `Bearer ${token}`, Prefer: 'outlook.timezone="UTC"' });
}

function publicHttps(url: URL): boolean {
  if (url.protocol !== "https:" || url.username || url.password || url.hostname === "localhost" || url.hostname.endsWith(".local")) return false;
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(url.hostname) || url.hostname.includes(":")) return false;
  return url.hostname.includes(".");
}

function teamsJoinUrl(value: unknown): string | null {
  const safe = safeExternalUrl(value);
  if (!safe) return null;
  const url = new URL(safe);
  if (!teamsHost(url.hostname)) return null;
  return url.toString();
}

/** OAuth bearer stays on Microsoft Graph. Later hops can be a short-lived file URL. */
export async function teamsDownload(token: string, start: string, maxBytes: number, accept: string): Promise<Uint8Array> {
  let current = start;
  let sendBearer = true;
  for (let hop = 0; hop < 3; hop++) {
    const url = new URL(current);
    if (!publicHttps(url) || (sendBearer && url.hostname !== "graph.microsoft.com")) throw new RevenueError("Microsoft Teams returned an invalid download address.", 502);
    const response: Response = await fetch(url, {
      headers: { Accept: accept, ...(sendBearer ? { Authorization: `Bearer ${token}` } : {}) },
      redirect: "manual", signal: AbortSignal.timeout(25000), cache: "no-store",
    });
    if (response.status >= 300 && response.status < 400) {
      const location: string | null = response.headers.get("location");
      if (!location) throw new ProviderError("Microsoft Teams", response.status);
      const next: URL = new URL(location, url);
      sendBearer = next.hostname === "graph.microsoft.com";
      current = next.toString();
      continue;
    }
    if (!response.ok) {
      const retry = Number(response.headers.get("retry-after"));
      const body = await response.text().catch(() => "");
      console.error("Microsoft Teams request failed", response.status, redactProviderBody(body));
      throw new ProviderError("Microsoft Teams", response.status, Number.isFinite(retry) ? Math.min(3600, retry) : 0, providerFailureDetail(body));
    }
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > maxBytes) throw new RevenueError("Microsoft Teams recording is too large to copy.", 413);
    const reader = response.body?.getReader();
    if (!reader) {
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > maxBytes) throw new RevenueError("Microsoft Teams recording is too large to copy.", 413);
      return bytes;
    }
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > maxBytes) { await reader.cancel(); throw new RevenueError("Microsoft Teams recording is too large to copy.", 413); }
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return bytes;
  }
  throw new RevenueError("Microsoft Teams download redirected too many times.", 502);
}

function utc(value: unknown): string {
  const text = typeof value === "string" ? value : "";
  if (!text) return "";
  return /(Z|[+-]\d\d:\d\d)$/i.test(text) ? text : `${text}Z`;
}

function consumerMailbox(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase() || "";
  return CONSUMER_DOMAINS.has(domain);
}

async function teamsUser(token: string): Promise<{ id: string; email: string; name: string }> {
  const me = await graphRequest<any>(token, "/v1.0/me?$select=id,displayName,mail,userPrincipalName");
  const email = String(me.mail || me.userPrincipalName || "").trim();
  const id = String(me.id || "");
  if (!email.includes("@") || !USER_ID.test(id)) throw new RevenueError("Microsoft Teams returned an invalid user account.", 502);
  if (consumerMailbox(email)) throw new RevenueError("Teams transcripts need a work or school account. Personal Microsoft accounts can sign in, but they cannot read meeting transcripts.", 400);
  const name = String(me.displayName || email.split("@")[0] || "Sales Rep").slice(0, 200);
  return { id, email, name };
}

export async function verifyTeams(token: string): Promise<Partial<ConnectionConfig>> {
  const user = await teamsUser(token);
  const end = new Date();
  const start = new Date(end.getTime() - DAY);
  const query = new URLSearchParams({ startDateTime: start.toISOString(), endDateTime: end.toISOString(), $top: "1", $select: "id,isOnlineMeeting" });
  await graphRequest(token, `/v1.0/me/calendarView?${query}`);
  return { accountEmail: user.email, accountName: user.name };
}

function bounds(state: SyncCursor): { start: string; end: string } {
  const endMs = Date.parse(state.syncStartedAt || new Date().toISOString());
  const startMs = state.createdAfter ? Date.parse(state.createdAfter) : endMs - WINDOW_DAYS * DAY;
  if (!Number.isFinite(endMs) || !Number.isFinite(startMs)) throw new RevenueError("Invalid Microsoft Teams sync window.");
  return { start: new Date(Math.min(startMs, endMs)).toISOString(), end: new Date(endMs).toISOString() };
}

function continuation(value: string): string {
  const url = new URL(value, GRAPH);
  const allowed = url.pathname === "/v1.0/me/calendarView"
    || url.pathname.startsWith("/v1.0/me/onlineMeetings/getAllTranscripts")
    || url.pathname.startsWith("/v1.0/me/onlineMeetings/getAllRecordings");
  if (url.origin !== GRAPH || url.username || url.password || url.hash || !allowed) throw new RevenueError("Microsoft Teams returned an invalid page.", 502);
  return url.pathname + url.search;
}

function deltaPath(kind: "transcripts" | "recordings", userId: string, start: string, end: string): string {
  if (!USER_ID.test(userId)) throw new RevenueError("Microsoft Teams returned an invalid user account.", 502);
  const name = kind === "transcripts" ? "getAllTranscripts" : "getAllRecordings";
  return `/v1.0/me/onlineMeetings/${name}/delta(meetingOrganizerUserId='${userId}',startDateTime=${start},endDateTime=${end})`;
}

function calendarPath(start: string, end: string): string {
  const query = new URLSearchParams({
    startDateTime: start, endDateTime: end, $top: "20",
    $select: "id,subject,start,end,isAllDay,isOnlineMeeting,isOrganizer,onlineMeeting,organizer,attendees,webLink",
  });
  return `/v1.0/me/calendarView?${query}`;
}

function joinFilterPath(join: string): string {
  const escaped = join.replace(/'/g, "''");
  return `/v1.0/me/onlineMeetings?$filter=${encodeURIComponent(`JoinWebUrl eq '${escaped}'`)}`;
}

async function deltaPage(token: string, path: string): Promise<{ allowed: boolean; items: any[]; next?: string }> {
  try {
    const result = await graphRequest<any>(token, path);
    const next = typeof result["@odata.nextLink"] === "string" ? result["@odata.nextLink"] : undefined;
    return { allowed: true, items: providerList(result.value, "Microsoft Teams"), next };
  } catch (error) {
    if (error instanceof ProviderError && [400, 403].includes(error.providerStatus)) return { allowed: false, items: [] };
    throw error;
  }
}

function meetingIdOf(item: any): string {
  const id = String(item?.meetingId || "");
  return id.length > 0 && id.length <= ID_LIMIT ? id : "";
}

function eventJoin(event: any): string | null {
  return teamsJoinUrl(event?.onlineMeeting?.joinUrl || event?.onlineMeetingUrl);
}

function organizedBy(event: any, email: string): boolean {
  if (event?.isOrganizer === true) return true;
  const organizer = String(event?.organizer?.emailAddress?.address || "").toLowerCase();
  return Boolean(organizer) && organizer === email.toLowerCase();
}

function peopleFromEvent(event: any): Person[] {
  const rows = Array.isArray(event?.attendees) ? event.attendees : [];
  return rows.map((row: any) => ({
    name: String(row?.emailAddress?.name || row?.emailAddress?.address || "Participant").slice(0, 200),
    email: String(row?.emailAddress?.address || ""),
  }));
}

function peopleFromMeeting(meeting: any): Person[] {
  const organizer = meeting?.participants?.organizer;
  const attendees = Array.isArray(meeting?.participants?.attendees) ? meeting.participants.attendees : [];
  return [organizer, ...attendees].filter(Boolean).map((row: any) => ({
    name: String(row?.identity?.user?.displayName || row?.upn || "Participant").slice(0, 200),
    email: String(row?.upn || ""),
  }));
}

function deferredMeeting(id: string, raw: { subject?: string; start?: string; end?: string; joinUrl?: string | null; attendees?: Person[] }, user: { email: string; name: string }) {
  return {
    id, subject: raw.subject ? String(raw.subject).slice(0, 200) : "",
    start: raw.start || "", end: raw.end || "", joinUrl: raw.joinUrl || "",
    hostEmail: user.email, hostName: user.name, attendees: raw.attendees || [],
  };
}

async function resolveJoin(token: string, join: string): Promise<string | null> {
  try {
    const result = await graphRequest<any>(token, joinFilterPath(join));
    const rows = providerList(result.value, "Microsoft Teams", true);
    const id = String(rows[0]?.id || "");
    if (!id || id.length > ID_LIMIT) return null;
    return id;
  } catch (error) {
    if (error instanceof ProviderError && error.providerStatus === 404) return null;
    throw error;
  }
}

/** Delegated getAll* delta is application-only today. Probe once, remember the result, and list calendar meetings the user organized. */
export async function teamsPage(secrets: Secrets, state: SyncCursor): Promise<{ deferred: any[]; next: SyncCursor }> {
  const user = state.hostEmail && state.teamsUserId
    ? { id: state.teamsUserId, email: state.hostEmail, name: state.hostName || "Sales Rep" }
    : await teamsUser(secrets.token);
  const { start, end } = bounds(state);
  const firstPage = !state.after;
  const base: SyncCursor = { ...state, hostEmail: user.email, hostName: user.name, teamsUserId: user.id };
  let recordings = state.teamsRecordings;
  let extraIds: string[] = [];
  if (firstPage && recordings !== "no") {
    const probed = await deltaPage(secrets.token, deltaPath("recordings", user.id, start, end));
    recordings = probed.allowed ? "yes" : "no";
    extraIds = probed.allowed ? probed.items.map(meetingIdOf).filter(Boolean) : [];
  }
  let discovery = state.teamsDiscovery;
  let pageAfter = state.after;
  if (discovery !== "calendar") {
    const continuing = Boolean(pageAfter && pageAfter.includes("getAllTranscripts"));
    const path = continuing ? continuation(pageAfter || "") : deltaPath("transcripts", user.id, start, end);
    const probed = await deltaPage(secrets.token, path);
    if (probed.allowed) {
      const seen = new Set<string>();
      const deferred = [];
      for (const item of probed.items) {
        const id = meetingIdOf(item);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        deferred.push(deferredMeeting(id, { start: utc(item.createdDateTime) }, user));
      }
      if (firstPage) {
        for (const id of extraIds) {
          if (seen.has(id)) continue;
          seen.add(id);
          deferred.push(deferredMeeting(id, {}, user));
        }
      }
      const after = probed.next ? continuation(probed.next) : undefined;
      return { deferred, next: { ...base, teamsDiscovery: "delta", teamsRecordings: recordings, after, complete: !after } };
    }
    discovery = "calendar";
    if (continuing) pageAfter = undefined;
  }
  const path = pageAfter ? continuation(pageAfter) : calendarPath(start, end);
  const result = await graphRequest<any>(secrets.token, path);
  if (!Array.isArray(result.value)) throw new RevenueError("Microsoft Teams returned an invalid event list. Retry sync.", 502);
  const deferred = [];
  const seen = new Set<string>();
  for (const event of result.value) {
    if (event?.isAllDay || event?.isOnlineMeeting !== true || !organizedBy(event, user.email)) continue;
    const join = eventJoin(event);
    if (!join) continue;
    const id = await resolveJoin(secrets.token, join);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    deferred.push(deferredMeeting(id, {
      subject: event.subject, start: utc(event.start?.dateTime), end: utc(event.end?.dateTime), joinUrl: join, attendees: peopleFromEvent(event),
    }, user));
  }
  if (firstPage) {
    for (const id of extraIds) {
      if (seen.has(id)) continue;
      seen.add(id);
      deferred.push(deferredMeeting(id, {}, user));
    }
  }
  const nextLink = typeof result["@odata.nextLink"] === "string" ? continuation(result["@odata.nextLink"]) : undefined;
  return { deferred, next: { ...base, teamsDiscovery: "calendar", teamsRecordings: recordings, after: nextLink, complete: !nextLink } };
}

async function loadMeeting(token: string, id: string): Promise<any> {
  return graphRequest(token, `/v1.0/me/onlineMeetings/${teamsPathId(id)}`);
}

export async function fetchTeamsCall(secrets: Secrets, raw: any): Promise<ImportedMeeting | null> {
  const id = String(raw?.id || "");
  if (!id || id.length > ID_LIMIT) throw new RevenueError("Microsoft Teams meeting is missing an id.");
  let transcripts: any[];
  try {
    const listed = await graphRequest<any>(secrets.token, `/v1.0/me/onlineMeetings/${teamsPathId(id)}/transcripts`);
    transcripts = providerList(listed.value, "Microsoft Teams");
  } catch (error) {
    if (error instanceof ProviderError && error.providerStatus === 404) return null;
    throw error;
  }
  if (!transcripts.length) return null;
  const ordered = [...transcripts].sort((a, b) => String(b?.createdDateTime || "").localeCompare(String(a?.createdDateTime || "")));
  const transcriptId = String(ordered[0]?.id || "");
  if (!transcriptId || transcriptId.length > ID_LIMIT) return null;
  let vtt: string;
  try {
    const bytes = await teamsDownload(secrets.token, `${GRAPH}/v1.0/me/onlineMeetings/${teamsPathId(id)}/transcripts/${teamsPathId(transcriptId)}/content`, TRANSCRIPT_LIMIT, "text/vtt");
    vtt = new TextDecoder().decode(bytes);
  } catch (error) {
    if (error instanceof ProviderError && error.providerStatus === 404) return null;
    throw error;
  }
  const segments = parseZoomTranscript(vtt);
  if (!segments.length) return null;
  let attendees: Person[] = Array.isArray(raw.attendees) ? raw.attendees.filter((person: Person) => person?.email || person?.name) : [];
  let subject = raw.subject || "";
  let start = raw.start || "";
  let end = raw.end || "";
  let join = teamsJoinUrl(raw.joinUrl);
  if (!attendees.length) {
    const meeting = await loadMeeting(secrets.token, id);
    subject = subject || meeting.subject;
    start = start || meeting.startDateTime;
    end = end || meeting.endDateTime;
    join = join || teamsJoinUrl(meeting.joinWebUrl);
    attendees = peopleFromMeeting(meeting);
  }
  const hostEmail = String(raw.hostEmail || "");
  const hostName = String(raw.hostName || "Sales Rep");
  const listed = externalParticipants(attendees, hostEmail);
  const known = new Set(listed.map(person => person.name.toLowerCase()));
  for (const segment of segments) {
    if (known.has(segment.speaker.toLowerCase())) continue;
    listed.push({ name: segment.speaker, external: segment.speaker.toLowerCase() !== hostName.toLowerCase() });
    known.add(segment.speaker.toLowerCase());
  }
  if (hostEmail && !listed.some(person => person.email?.toLowerCase() === hostEmail.toLowerCase())) listed.unshift({ name: hostName, email: hostEmail, external: false });
  const prospect = listed.find(person => person.external);
  const startMs = Date.parse(utc(start));
  const endMs = Date.parse(utc(end));
  const durationSeconds = Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs ? Math.round((endMs - startMs) / 1000) : undefined;
  return normalizedMeeting({
    externalId: id, title: String(subject || "Microsoft Teams meeting"), repName: hostName, repEmail: hostEmail,
    participants: listed, prospectName: prospect?.name, prospectCompany: prospect?.email?.split("@")[1] || "",
    createdAt: utc(start) || undefined, durationSeconds, recordingPageUrl: join, segments,
  });
}

/** Copy a small recording into the existing encrypted store when it fits. A missing recording still leaves the transcript. */
export async function maybeStoreTeamsRecording(secrets: Secrets, callId: string, meetingId: string): Promise<boolean> {
  const existing = await db.select({ audioUrl: calls.audioUrl }).from(calls).where(and(eq(calls.id, callId), eq(calls.orgId, currentTenantId()))).get();
  if (existing?.audioUrl) return false;
  let recordings: any[];
  try {
    const listed = await graphRequest<any>(secrets.token, `/v1.0/me/onlineMeetings/${teamsPathId(meetingId)}/recordings`);
    recordings = providerList(listed.value, "Microsoft Teams", true);
  } catch (error) {
    if (error instanceof ProviderError && [403, 404].includes(error.providerStatus)) return false;
    throw error;
  }
  if (!recordings.length) return false;
  const ordered = [...recordings].sort((a, b) => String(b?.createdDateTime || "").localeCompare(String(a?.createdDateTime || "")));
  const recordingId = String(ordered[0]?.id || "");
  if (!recordingId || recordingId.length > ID_LIMIT) return false;
  let bytes: Uint8Array;
  try {
    bytes = await teamsDownload(secrets.token, `${GRAPH}/v1.0/me/onlineMeetings/${teamsPathId(meetingId)}/recordings/${teamsPathId(recordingId)}/content`, AUDIO_LIMIT, "video/mp4, audio/mp4");
  } catch (error) {
    if (error instanceof RevenueError && error.status === 413) return false;
    if (error instanceof ProviderError && [403, 404].includes(error.providerStatus)) return false;
    throw error;
  }
  const audioUrl = await saveCallAudio(callId, bytes, "video/mp4", "teams-recording.mp4");
  if (!audioUrl) return false;
  await db.update(calls).set({ audioUrl }).where(and(eq(calls.id, callId), eq(calls.orgId, currentTenantId()))).run();
  return true;
}

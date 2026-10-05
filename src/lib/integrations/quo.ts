import { createHash, createHmac } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { ProviderError, providerList, providerRequest } from "./http";
import { normalizedMeeting } from "./meeting";
import { saveCallAudio } from "../callAudioStore";
import { db } from "../db";
import { calls } from "../db/schema";
import { currentTenantId } from "../tenant";
import { RevenueError, safeExternalUrl, secureEqual } from "../revenue/security";
import { normalizeE164 } from "../revenue/matching";
import type { SyncCursor } from "../revenue/types";

const ORIGIN = "https://api.quo.com";
const VERSION = "2026-03-30";
const AUDIO_LIMIT = 20 * 1024 * 1024;
const HISTORY_MS = 30 * 86400000;
const CALL_ID = /^AC[A-Za-z0-9]{1,80}$/;
const CONTACT_ID = /^[A-Za-z0-9_-]{1,80}$/;
export const QUO_EVENTS = ["call.completed", "call.recording.completed", "call.transcript.completed", "call.summary.completed"] as const;

type Secrets = Record<string, string>;
type QuoContact = { id: string; name: string; email: string; phones: string[]; company: string };
type Directory = { at: number; users?: Map<string, { name: string; email: string }>; contacts?: QuoContact[] };
const directories = new Map<string, Directory>();

export function clearQuoDirectoryCache() {
  directories.clear();
}

function directory(token: string): Directory {
  const key = createHash("sha256").update(token).digest("hex");
  const found = directories.get(key);
  if (found && Date.now() - found.at < 10 * 60 * 1000) return found;
  const fresh: Directory = { at: Date.now() };
  directories.set(key, fresh);
  return fresh;
}

export function quoRequest<T>(secrets: Secrets, path: string, init?: RequestInit) {
  const headers: Record<string, string> = { Authorization: secrets.token };
  if (!path.startsWith("/v1/") && !path.startsWith("/v1?")) headers["Quo-Api-Version"] = VERSION;
  if (init?.body) headers["Content-Type"] = "application/json";
  return providerRequest<T>("Quo", ORIGIN, path, headers, init);
}

function callId(value: unknown): string {
  const id = String(value || "");
  if (!CALL_ID.test(id)) throw new RevenueError("Invalid Quo call ID.");
  return id;
}

function publicHttps(url: URL): boolean {
  if (url.protocol !== "https:" || url.username || url.password || url.hostname === "localhost" || url.hostname.endsWith(".local")) return false;
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(url.hostname) || url.hostname.includes(":")) return false;
  return url.hostname.includes(".");
}

/** Signed recording hosts must not receive the workspace API key. */
async function quoDownload(token: string, start: string, maxBytes: number): Promise<Uint8Array> {
  let current = start;
  for (let hop = 0; hop < 3; hop++) {
    const url = new URL(current);
    if (!publicHttps(url)) throw new RevenueError("Quo returned an invalid recording address.", 502);
    const response = await fetch(url, {
      headers: url.hostname === "api.quo.com" ? { Authorization: token } : {},
      redirect: "manual", signal: AbortSignal.timeout(25000), cache: "no-store",
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new ProviderError("Quo", response.status);
      current = new URL(location, url).toString();
      continue;
    }
    if (!response.ok) {
      const retry = Number(response.headers.get("retry-after"));
      throw new ProviderError("Quo", response.status, Number.isFinite(retry) ? Math.min(3600, retry) : 0);
    }
    const length = Number(response.headers.get("content-length"));
    if (Number.isFinite(length) && length > maxBytes) throw new RevenueError("Recording is too large to store.", 413);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > maxBytes) throw new RevenueError("Recording is too large to store.", 413);
    return bytes;
  }
  throw new RevenueError("Quo recording redirect did not finish.", 502);
}

export function verifyQuoWebhook(secret: string, headers: Headers, raw: string, now = Date.now()): boolean {
  if (!secret) return false;
  const id = headers.get("webhook-id") || "";
  const timestamp = headers.get("webhook-timestamp") || "";
  const signature = headers.get("webhook-signature") || "";
  if (!id || !/^\d+$/.test(timestamp)) return false;
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || Math.abs(now / 1000 - seconds) > 300) return false;
  const material = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  const key = Buffer.from(material, "base64");
  if (!key.length) return false;
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${raw}`).digest("base64");
  return signature.split(" ").some(part => part.startsWith("v1,") && secureEqual(expected, part.slice(3)));
}

/** Returns the call to import, or null when the event says a transcript or summary will not arrive. */
export function quoEventCallId(payload: any): string | null {
  const type = String(payload?.type || "");
  if (!QUO_EVENTS.includes(type as (typeof QUO_EVENTS)[number])) return null;
  const resource = payload?.data?.resource;
  if (!resource || typeof resource !== "object") throw new RevenueError("Quo call ID is missing.");
  if (type === "call.transcript.completed" || type === "call.summary.completed") {
    const status = String(resource.processingStatus || "");
    if (status === "absent" || status === "failed") return null;
    return callId(resource.callId);
  }
  return callId(resource.id);
}

export function quoWebhookContactIds(payload: any): string[] {
  const contacts = payload?.data?.context?.contacts;
  if (contacts?.lookupStatus !== "matched" || !Array.isArray(contacts.ids)) return [];
  return contacts.ids.filter((id: unknown): id is string => typeof id === "string" && CONTACT_ID.test(id)).slice(0, 20);
}

function windowStart(state: SyncCursor): string {
  const started = Date.parse(state.syncStartedAt || "") || Date.now();
  const from = state.createdAfter ? Date.parse(state.createdAfter) : started - HISTORY_MS;
  if (!Number.isFinite(from)) throw new RevenueError("Invalid Quo sync window.");
  return new Date(from).toISOString();
}

export async function quoPage(secrets: Secrets, state: SyncCursor) {
  const started = Date.parse(state.syncStartedAt || "") || Date.now();
  const query = new URLSearchParams({ status: "completed", include: "summary", limit: "50", "createdAt[gte]": windowStart(state), "createdAt[lte]": new Date(started).toISOString() });
  if (state.after) query.set("after", state.after);
  const result = await quoRequest<{ data: any[]; nextCursor?: string | null }>(secrets, `/calls?${query}`);
  const deferred = providerList(result.data, "Quo").filter(call => call?.status === "completed" && CALL_ID.test(String(call.id || "")));
  const after = typeof result.nextCursor === "string" && result.nextCursor ? result.nextCursor : undefined;
  return { deferred, next: { ...state, after, complete: !after } };
}

async function workspaceUsers(secrets: Secrets) {
  const cache = directory(secrets.token);
  if (cache.users) return cache.users;
  const users = new Map<string, { name: string; email: string }>();
  let after = "";
  for (let page = 0; page < 10; page++) {
    const query = new URLSearchParams({ limit: "50" });
    if (after) query.set("after", after);
    const result = await quoRequest<{ data: any[]; nextCursor?: string | null }>(secrets, `/users?${query}`);
    for (const user of providerList(result.data, "Quo")) {
      if (typeof user?.id !== "string") continue;
      const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "Sales Rep";
      users.set(user.id, { name, email: typeof user.email === "string" ? user.email : "" });
    }
    after = typeof result.nextCursor === "string" ? result.nextCursor : "";
    if (!after) break;
  }
  cache.users = users;
  return users;
}

function contactFromFields(id: string, fields: any, phones: string[], email: string): QuoContact {
  return {
    id, name: [fields?.firstName, fields?.lastName].filter(Boolean).join(" "),
    email: email.includes("@") ? email : "", phones, company: typeof fields?.company === "string" ? fields.company : "",
  };
}

function normalizeV1Contact(raw: any): QuoContact | null {
  const fields = raw?.defaultFields || raw || {};
  const phones: string[] = [];
  for (const item of Array.isArray(fields.phoneNumbers) ? fields.phoneNumbers : []) {
    const phone = normalizeE164(item?.value || item);
    if (phone && !phones.includes(phone)) phones.push(phone);
  }
  const email = String(fields.emails?.[0]?.value || "");
  const id = String(raw?.id || "");
  if (!id) return null;
  return contactFromFields(id, fields, phones, email);
}

async function phoneDirectory(secrets: Secrets): Promise<QuoContact[]> {
  const cache = directory(secrets.token);
  if (cache.contacts) return cache.contacts;
  const contacts: QuoContact[] = [];
  let pageToken = "";
  try {
    for (let page = 0; page < 5; page++) {
      const query = new URLSearchParams({ maxResults: "50" });
      if (pageToken) query.set("pageToken", pageToken);
      const result = await quoRequest<any>(secrets, `/v1/contacts?${query}`);
      for (const row of providerList(result.data, "Quo")) {
        const person = normalizeV1Contact(row);
        if (person) contacts.push(person);
      }
      pageToken = String(result.nextPageToken || result.nextCursor || "");
      if (!pageToken) break;
    }
  } catch (error) {
    if (!(error instanceof ProviderError) || ![403, 404].includes(error.providerStatus)) throw error;
  }
  cache.contacts = contacts;
  return contacts;
}

async function peopleByIds(secrets: Secrets, ids: string[]): Promise<QuoContact[]> {
  const people: QuoContact[] = [];
  for (const id of ids) {
    try {
      const contact = (await quoRequest<{ data: any }>(secrets, `/contacts/${encodeURIComponent(id)}`)).data || {};
      const props = providerList((await quoRequest<{ data: any[] }>(secrets, `/contacts/${encodeURIComponent(id)}/properties`)).data, "Quo");
      const phones: string[] = [];
      for (const item of props) {
        if (item?.type !== "phone-number") continue;
        const phone = normalizeE164(item.value);
        if (phone && !phones.includes(phone)) phones.push(phone);
      }
      const email = String(props.find(item => item?.type === "email")?.value || "");
      people.push(contactFromFields(id, contact, phones, email));
    } catch (error) {
      if (error instanceof ProviderError && [403, 404].includes(error.providerStatus)) continue;
      throw error;
    }
  }
  return people;
}

async function loadCall(secrets: Secrets, id: string, raw: any) {
  if (Array.isArray(raw?.participants)) return raw;
  try { return (await quoRequest<{ data: any }>(secrets, `/calls/${encodeURIComponent(id)}?include=summary`)).data; }
  catch (error) {
    if (error instanceof ProviderError && error.providerStatus === 404) return null;
    if (!(error instanceof ProviderError) || error.providerStatus !== 403) throw error;
  }
  try { return (await quoRequest<{ data: any }>(secrets, `/calls/${encodeURIComponent(id)}`)).data; }
  catch (error) {
    if (error instanceof ProviderError && error.providerStatus === 404) return null;
    throw error;
  }
}

async function loadTranscripts(secrets: Secrets, id: string) {
  const transcripts: any[] = [];
  let after = "";
  try {
    for (let page = 0; page < 20; page++) {
      const query = new URLSearchParams({ limit: "50" });
      if (after) query.set("after", after);
      const result = await quoRequest<{ data: any[]; nextCursor?: string | null }>(secrets, `/calls/${encodeURIComponent(id)}/transcripts?${query}`);
      transcripts.push(...providerList(result.data, "Quo"));
      after = typeof result.nextCursor === "string" ? result.nextCursor : "";
      if (!after) break;
    }
  } catch (error) {
    if (error instanceof ProviderError && [403, 404].includes(error.providerStatus)) return null;
    throw error;
  }
  return transcripts;
}

function summaryText(summary: any): { summary: string; actionItems: { id: string; description: string; completed: boolean }[] } {
  if (!summary || summary.status === "absent" || summary.status === "failed" || summary.status === "in-progress") return { summary: "", actionItems: [] };
  const lines = Array.isArray(summary.summary) ? summary.summary.filter((line: unknown) => typeof line === "string" && line.trim()).map((line: string) => line.trim()) : [];
  const steps = Array.isArray(summary.nextSteps) ? summary.nextSteps.filter((line: unknown) => typeof line === "string" && line.trim()) : [];
  return { summary: lines.join("\n"), actionItems: steps.map((description: string) => ({ id: "", description: description.trim(), completed: false })) };
}

export async function fetchQuoCall(secrets: Secrets, raw: any) {
  const id = callId(raw?.id || raw?.callId);
  const call = await loadCall(secrets, id, raw);
  if (!call || (call.status && call.status !== "completed")) return null;
  const transcripts = await loadTranscripts(secrets, id);
  if (!transcripts) return null;
  const ready = transcripts.filter(item => item?.status === "completed" && Array.isArray(item.dialogue) && item.dialogue.some((turn: any) => typeof turn?.content === "string" && turn.content.trim()))
    .sort((a, b) => Date.parse(a.startTime || "") - Date.parse(b.startTime || ""));
  if (!ready.length) return null;
  const users = await workspaceUsers(secrets);
  const participants = Array.isArray(call.participants) ? call.participants : [];
  const external = participants.find((person: any) => person?.phoneNumber && !String(person.actorId || "").startsWith("US") && !String(person.actorId || "").startsWith("SYU"))
    || participants.find((person: any) => person?.phoneNumber);
  const externalPhone = normalizeE164(external?.phoneNumber) || "";
  const contactIds = Array.isArray(raw?.contactIds) ? raw.contactIds.filter((item: unknown): item is string => typeof item === "string" && CONTACT_ID.test(item)).slice(0, 20) : [];
  const directoryPeople = contactIds.length ? await peopleByIds(secrets, contactIds) : await phoneDirectory(secrets);
  const contact = directoryPeople.find(person => externalPhone && person.phones.includes(externalPhone)) || (contactIds.length ? directoryPeople[0] : undefined);
  const prospectName = contact?.name || externalPhone || "Prospect";
  const repId = [call.answeredBy, call.initiatedBy, call.actorId, ...participants.map((person: any) => person?.actorId)].find(actor => typeof actor === "string" && actor.startsWith("US"));
  const rep = (repId && users.get(repId)) || { name: "Sales Rep", email: "" };
  let offset = 0;
  const segments = ready.flatMap(transcript => {
    const turns = transcript.dialogue.filter((turn: any) => typeof turn?.content === "string" && turn.content.trim()).map((turn: any) => {
      const actor = String(turn.actorId || turn.userId || "");
      const user = users.get(actor);
      const speaker = actor.startsWith("US") ? user?.name || rep.name : actor.startsWith("SYU") ? user?.name || "Quo AI" : prospectName;
      const start = offset + (Number(turn.start) || 0);
      const end = offset + (Number(turn.end) || Number(turn.start) || 0);
      return { speaker, text: String(turn.content).trim(), start, end, timing: "provider" as const };
    });
    const spoken = turns.reduce((max: number, turn: { end: number }) => Math.max(max, turn.end - offset), 0);
    offset += Number(transcript.duration) || spoken;
    return turns;
  });
  const written = summaryText(call.summary);
  const direction = call.direction === "outgoing" ? "Outgoing" : call.direction === "incoming" ? "Incoming" : "Call";
  const email = contact?.email || "";
  return normalizedMeeting({
    externalId: id, title: `Quo · ${direction} · ${prospectName}`, repName: rep.name, repEmail: rep.email,
    prospectName, prospectCompany: contact?.company || "", createdAt: call.answeredAt || call.createdAt || call.completedAt,
    durationSeconds: Number(call.duration) || undefined, recordingPageUrl: safeExternalUrl(call.links?.quo) || undefined, summary: written.summary,
    participants: [{ name: rep.name, email: rep.email, external: false }, { name: prospectName, email, external: true }],
    segments, actionItems: written.actionItems.map((item, index) => ({ ...item, id: `quo_${id}_${index}` })),
    crmMatches: [{ kind: "contact", email: email || undefined, phone: externalPhone || undefined, name: prospectName }],
  });
}

/** Copy the first completed recording that fits. Signed media URLs are not stored on the call. */
export async function maybeStoreQuoAudio(secrets: Secrets, callIdValue: string, externalId: string): Promise<boolean> {
  if (!CALL_ID.test(externalId)) return false;
  const existing = await db.select({ audioUrl: calls.audioUrl }).from(calls).where(and(eq(calls.id, callIdValue), eq(calls.orgId, currentTenantId()))).get();
  if (existing?.audioUrl) return false;
  let recordings: any[];
  try { recordings = providerList((await quoRequest<{ data: any[] }>(secrets, `/calls/${encodeURIComponent(externalId)}/recordings`)).data, "Quo"); }
  catch (error) { if (error instanceof ProviderError && [403, 404].includes(error.providerStatus)) return false; throw error; }
  const files = recordings.filter(file => file?.status === "completed" && safeExternalUrl(file.url))
    .sort((a, b) => Date.parse(a.startTime || "") - Date.parse(b.startTime || ""));
  for (const file of files) {
    let bytes: Uint8Array;
    try { bytes = await quoDownload(secrets.token, String(file.url), AUDIO_LIMIT); }
    catch (error) {
      if (error instanceof RevenueError && error.status === 413) continue;
      if (error instanceof ProviderError && [403, 404].includes(error.providerStatus)) return false;
      throw error;
    }
    const mime = typeof file.type === "string" && file.type.startsWith("audio/") ? file.type : "audio/mpeg";
    const audioUrl = await saveCallAudio(callIdValue, bytes, mime, "quo-recording.mp3");
    if (!audioUrl) return false;
    await db.update(calls).set({ audioUrl }).where(and(eq(calls.id, callIdValue), eq(calls.orgId, currentTenantId()))).run();
    return true;
  }
  return false;
}

export async function deleteQuoWebhook(secrets: Secrets, webhookId: string) {
  if (!webhookId) return;
  await quoRequest(secrets, `/webhooks/${encodeURIComponent(webhookId)}`, { method: "DELETE" });
}

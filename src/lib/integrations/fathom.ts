import { createHmac } from "node:crypto";
import { providerRequest } from "./http";
import { RevenueError, safeExternalUrl, secureEqual } from "../revenue/security";
import type { ImportedMeeting, Segment, SyncCursor } from "../revenue/types";
import { formatClock } from "../audio";

const ORIGIN = "https://api.fathom.ai/external/v1";
export function fathomRequest<T>(token: string, pathname: string, init?: RequestInit): Promise<T> {
  return providerRequest<T>("Fathom", ORIGIN, pathname, { "X-Api-Key": token, "Content-Type": "application/json" }, init);
}

export function verifyFathomWebhook(secret: string, headers: Headers, body: string, now = Date.now()): boolean {
  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signature = headers.get("webhook-signature");
  if (!id || !timestamp || !/^\d+$/.test(timestamp) || !signature || !secret.startsWith("whsec_")) return false;
  if (Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  const key = Buffer.from(secret.slice(6), "base64");
  if (key.length < 16) return false;
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
  return signature.split(/\s+/).some((part) => part.startsWith("v1,") && secureEqual(expected, part.slice(3)));
}

export function clockSeconds(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, value);
  if (typeof value !== "string") return 0;
  const parts = value.split(":");
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => !/^\d+(\.\d+)?$/.test(part))) return 0;
  return parts.reduce((sum, part) => sum * 60 + Number(part), 0);
}

/** Fathom playback/share URLs are web pages, not downloadable audio URLs. */
export function normalizeFathomMeeting(input: any): ImportedMeeting {
  const externalId = String(input?.recording_id || "");
  if (!/^\d+$/.test(externalId)) throw new RevenueError("Fathom meeting is missing a recording_id.");
  const rawTurns = Array.isArray(input.transcript) ? input.transcript : input.transcript?.transcript;
  const segments: Segment[] = (Array.isArray(rawTurns) ? rawTurns : []).flatMap((turn: any) => {
    if (typeof turn?.text !== "string" || !turn.text.trim()) return [];
    return [{ speaker: String(turn.speaker?.display_name || turn.speaker || "Unknown"),
      email: turn.speaker?.matched_calendar_invitee_email || undefined,
      text: turn.text.trim(), start: clockSeconds(turn.timestamp), timing: "provider" as const }];
  }).sort((a: Segment, b: Segment) => a.start - b.start);
  if (!segments.length) throw new RevenueError("Fathom meeting has no transcript. Enable transcripts in the webhook or API request.");
  const start = Date.parse(input.recording_start_time);
  const end = Date.parse(input.recording_end_time);
  const durationSeconds = Number.isFinite(end - start) && end > start ? Math.ceil((end - start) / 1000) : Math.ceil(segments.at(-1)!.start + 5);
  segments.forEach((segment, index) => { segment.end = segments[index + 1]?.start ?? durationSeconds; });
  const invitees = Array.isArray(input.calendar_invitees) ? input.calendar_invitees : [];
  const participants = invitees.map((person: any) => ({ name: String(person.name || person.email || "Participant"), email: person.email, external: Boolean(person.is_external) }));
  const prospect = invitees.find((person: any) => person.is_external);
  const matches = input.crm_matches || {};
  const crmMatches = ["contacts", "companies", "deals"].flatMap((kind) => (Array.isArray(matches[kind]) ? matches[kind] : []).map((record: any) => ({
    kind: kind === "companies" ? "company" : kind === "contacts" ? "contact" : "deal", name: record.name, email: record.email,
    externalId: typeof record.record_url === "string" ? record.record_url.match(/\/(\d+)(?:[/?#]|$)/g)?.at(-1)?.replace(/\D/g, "") : undefined,
  })));
  const createdAt = Date.parse(input.created_at);
  return {
    externalId, title: String(input.title || input.meeting_title || "Fathom meeting").slice(0, 200),
    repName: String(input.recorded_by?.name || "Sales Rep"), repEmail: String(input.recorded_by?.email || ""),
    prospectName: String(prospect?.name || matches.contacts?.[0]?.name || "Prospect"),
    prospectCompany: String(matches.companies?.[0]?.name || prospect?.email_domain || prospect?.email?.split("@")[1] || ""),
    durationSeconds, transcriptText: segments.map((turn) => `[${formatClock(turn.start)}] ${turn.speaker}: ${turn.text}`).join("\n"),
    createdAt: Number.isFinite(createdAt) ? new Date(createdAt).toISOString() : new Date().toISOString(),
    recordingPageUrl: safeExternalUrl(input.share_url || input.url), participants, segments,
    summary: typeof input.default_summary?.markdown_formatted === "string" ? input.default_summary.markdown_formatted : "",
    actionItems: (Array.isArray(input.action_items) ? input.action_items : []).map((item: any, i: number) => ({
      id: `fathom_${externalId}_${i}`, description: String(item.description || ""), completed: Boolean(item.completed),
      assignee: item.assignee?.name || item.assignee?.email, timestamp: clockSeconds(item.recording_timestamp),
    })).filter((item: { description: string }) => item.description), crmMatches,
  };
}

export async function fathomPage(token: string, cursor: SyncCursor) {
  const query = new URLSearchParams({ include_transcript: "true", include_summary: "true", include_action_items: "true", include_crm_matches: "true" });
  if (cursor.after) query.set("cursor", cursor.after);
  if (cursor.createdAfter) query.set("created_after", cursor.createdAfter);
  const page = await fathomRequest<{ items: any[]; next_cursor?: string }>(token, `/meetings?${query}`);
  const meetings: ImportedMeeting[] = [];
  const deferred: any[] = [];
  let skipped = 0;
  for (const item of page.items || []) {
    const transcript = Array.isArray(item.transcript) ? item.transcript : item.transcript?.transcript;
    if ((!Array.isArray(transcript) || !transcript.length) && /^\d+$/.test(String(item.recording_id || ""))) {
      // Missing transcripts get individual jobs so a page cannot exceed the request budget.
      deferred.push(item);
      continue;
    }
    try { meetings.push(normalizeFathomMeeting(item)); } catch (err) { if (err instanceof RevenueError) skipped++; else throw err; }
  }
  return { meetings, deferred, skipped, next: page.next_cursor || null };
}

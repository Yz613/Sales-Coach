import { ProviderError, providerRequest, providerList } from "./http";
import { normalizedMeeting } from "./meeting";
import { RevenueError } from "../revenue/security";
import type { SyncCursor } from "../revenue/types";

export function aircallRequest<T>(secrets: Record<string, string>, path: string, init?: RequestInit) {
  return providerRequest<T>("Aircall", "https://api.aircall.io/v1", path, { Authorization: `Basic ${Buffer.from(`${secrets.apiId}:${secrets.token}`).toString("base64")}`, "Content-Type": "application/json" }, init);
}
export async function aircallPage(secrets: Record<string, string>, state: SyncCursor) {
  const page = Number(state.after || 1); if (!Number.isInteger(page) || page < 1) throw new RevenueError("Invalid Aircall page.");
  const query = new URLSearchParams({ page: String(page), per_page: "50", order: "asc", fetch_contact: "true", fetch_short_urls: "true" });
  if (state.createdAfter) query.set("from", String(Math.floor(Date.parse(state.createdAfter) / 1000)));
  if (state.syncStartedAt) query.set("to", String(Math.floor(Date.parse(state.syncStartedAt) / 1000)));
  const result = await aircallRequest<any>(secrets, `/calls?${query}`);
  if (page >= 200 && result.meta?.next_page_link) throw new RevenueError("Aircall's 10,000-call export limit was reached. Contact Aircall for a historical export.");
  return { deferred: providerList(result.calls, "Aircall").filter((call: any) => call.status === "done"), next: { ...state, after: String(page + 1), complete: !result.meta?.next_page_link } };
}
export async function fetchAircallCall(secrets: Record<string, string>, raw: any) {
  const id = String(raw.id || ""); if (!/^\d+$/.test(id)) throw new RevenueError("Invalid Aircall call ID.");
  const result = raw.user ? { call: raw } : await aircallRequest<any>(secrets, `/calls/${id}?fetch_contact=true&fetch_short_urls=true`);
  const call = result.call || raw;
  let transcript: any;
  try { transcript = (await aircallRequest<any>(secrets, `/calls/${id}/transcription`)).transcription; }
  catch (error) { if (error instanceof ProviderError && error.providerStatus === 404) return null; throw error; }
  if (!transcript?.content?.utterances?.length) return null;
  let summary = "";
  try { summary = (await aircallRequest<any>(secrets, `/calls/${id}/summary`)).summary?.content || ""; }
  catch (error) { if (!(error instanceof ProviderError) || ![403, 404].includes(error.providerStatus)) throw error; }
  const rep = call.user || {}; const contact = call.contact || {};
  const prospect = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || call.raw_digits || "Prospect";
  const email = contact.emails?.[0]?.value || contact.emails?.[0]?.email || "";
  return normalizedMeeting({ externalId: id, title: `Aircall · ${prospect}`, repName: rep.name, repEmail: rep.email, prospectName: prospect,
    prospectCompany: contact.company_name || "", createdAt: transcript.call_created_at || new Date(Number(call.started_at) * 1000).toISOString(), durationSeconds: call.duration,
    recordingPageUrl: call.recording_short_url || call.voicemail_short_url, summary,
    participants: [{ name: rep.name || "Sales Rep", email: rep.email, external: false }, { name: prospect, email, external: true }],
    segments: transcript.content.utterances.map((turn: any) => ({ speaker: turn.participant_type === "external" ? prospect : turn.participant_type === "ai_voice_agent" ? "Aircall AI agent" : turn.user_id && rep.id && String(turn.user_id) !== String(rep.id) ? `Agent ${turn.user_id}` : rep.name || "Sales Rep", text: turn.text,
      start: Number(turn.start_time) || 0, end: Number(turn.end_time) || undefined, timing: "provider" as const })) });
}

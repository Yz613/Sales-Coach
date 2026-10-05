import { providerRequest, ProviderError, providerList } from "./http";
import { normalizedMeeting, externalParticipants } from "./meeting";
import { RevenueError } from "../revenue/security";
import type { ImportedMeeting, SyncCursor } from "../revenue/types";
import { GONG_CONTENT_SELECTOR, normalizeGongCall } from "./gong";
import { aircallPage, aircallRequest, fetchAircallCall } from "./aircall";
import { fetchQuoCall, quoPage, quoRequest } from "./quo";
import { fetchZoomCall, verifyZoom, zoomPage } from "./zoom";
import { fetchGoogleMeetCall, googleMeetPage, verifyGoogleMeet } from "./google-meet";
import { fetchTeamsCall, teamsPage, verifyTeams } from "./teams";

export type CallProvider = "fireflies" | "tldv" | "gong" | "close" | "aircall" | "zoom" | "google-meet" | "microsoft-teams" | "quo";
type Secrets = Record<string, string>;
const FIREFLIES_FIELDS = `id title date duration host_email organizer_email participants transcript_url sentences { speaker_name text start_time end_time } summary { overview action_items }`;
export async function firefliesQuery<T>(token: string, query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const response = await providerRequest<{ data?: T; errors?: { extensions?: { code?: string } }[] }>("Fireflies", "https://api.fireflies.ai", "/graphql", { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, { method: "POST", body: JSON.stringify({ query, variables }) });
  if (response.errors?.length || !response.data) {
    const code = response.errors?.[0]?.extensions?.code || "";
    throw new ProviderError("Fireflies", /auth|forbidden/i.test(code) ? 403 : /rate|limit/i.test(code) ? 429 : 400, 60);
  }
  return response.data;
}
function tldvRequest<T>(secrets: Secrets, path: string) { return providerRequest<T>("tl;dv", "https://pasta.tldv.io/v1alpha1", path, { "x-api-key": secrets.token }); }
function gongRequest<T>(secrets: Secrets, path: string, body?: unknown) {
  return providerRequest<T>("Gong", "https://api.gong.io", path, { Authorization: `Basic ${Buffer.from(`${secrets.token}:${secrets.apiSecret}`).toString("base64")}`, "Content-Type": "application/json" }, body ? { method: "POST", body: JSON.stringify(body) } : {});
}
function closeRequest<T>(secrets: Secrets, path: string) { return providerRequest<T>("Close", "https://api.close.com/api/v1", path, { Authorization: `Basic ${Buffer.from(`${secrets.token}:`).toString("base64")}` }); }
const CLOSE_FIELDS = "id,date_created,date_updated,user_id,lead_id,contact_id,duration,recording_transcript,voicemail_transcript";

export async function verifyCallProvider(provider: CallProvider, secrets: Secrets) {
  if (provider === "zoom") { await verifyZoom(secrets.token); return; }
  if (provider === "google-meet") { await verifyGoogleMeet(secrets.token); return; }
  if (provider === "microsoft-teams") { await verifyTeams(secrets.token); return; }
  if (provider === "aircall") await aircallRequest(secrets, "/calls?per_page=1&fetch_contact=true");
  if (provider === "quo") await quoRequest(secrets, "/users?limit=1");
  if (provider === "fireflies") await firefliesQuery(secrets.token, "query { transcripts(limit: 1) { id } }");
  if (provider === "tldv") await tldvRequest(secrets, "/meetings?limit=1&page=1");
  if (provider === "gong") await gongRequest(secrets, "/v2/calls/extensive", { filter: { fromDateTime: new Date(Date.now() - 86400000).toISOString(), toDateTime: new Date().toISOString() }, contentSelector: GONG_CONTENT_SELECTOR });
  if (provider === "close") await closeRequest(secrets, `/activity/call/?_limit=1&_fields=${CLOSE_FIELDS}`);
}

/** Page only metadata; each transcript has its own durable, retryable job. */
export async function callProviderPage(provider: CallProvider, secrets: Secrets, state: SyncCursor): Promise<{ deferred: any[]; next: SyncCursor }> {
  if (provider === "zoom") return zoomPage(secrets, state);
  if (provider === "google-meet") return googleMeetPage(secrets, state);
  if (provider === "microsoft-teams") return teamsPage(secrets, state);
  if (provider === "aircall") return aircallPage(secrets, state);
  if (provider === "quo") return quoPage(secrets, state);
  if (provider === "fireflies") {
    const skip = Number(state.after || 0);
    const response = await firefliesQuery<{ transcripts: any[] }>(secrets.token,
      "query($skip: Int, $from: DateTime, $to: DateTime) { transcripts(limit: 25, skip: $skip, fromDate: $from, toDate: $to) { id } }",
      { skip, from: state.createdAfter || null, to: state.syncStartedAt || null });
    return { deferred: providerList(response.transcripts, provider), next: { ...state, after: String(skip + 25), complete: (providerList(response.transcripts, provider)).length < 25 } };
  }
  if (provider === "tldv") {
    const page = Number(state.after || 1); const query = new URLSearchParams({ page: String(page), limit: "25" });
    if (state.createdAfter) query.set("from", state.createdAfter);
    if (state.syncStartedAt) query.set("to", state.syncStartedAt);
    const response = await tldvRequest<{ results: any[]; pages: number }>(secrets, `/meetings?${query}`);
    // The API caps searches at 10,000 records; show the limit rather than silently losing history.
    if (page >= 400 && page < response.pages) throw new RevenueError("tl;dv history exceeds its 10,000-meeting export limit. Use a narrower date range.");
    return { deferred: providerList(response.results, provider), next: { ...state, after: String(page + 1), complete: page >= response.pages || !(providerList(response.results, provider)).length } };
  }
  if (provider === "gong") {
    const response = await gongRequest<{ calls: any[]; records?: { cursor?: string; totalRecords?: number } }>(secrets, "/v2/calls/extensive", {
      ...(state.after ? { cursor: state.after } : {}), filter: { ...(state.createdAfter ? { fromDateTime: state.createdAfter } : {}), toDateTime: state.syncStartedAt || new Date().toISOString() }, contentSelector: GONG_CONTENT_SELECTOR,
    });
    return { deferred: providerList(response.calls, provider, response.records?.totalRecords === 0).filter(call => call.metaData?.isPrivate !== true).map(call => ({ ...call, id: call.metaData?.id })), next: { ...state, after: response.records?.cursor, complete: !response.records?.cursor } };
  }
  const skip = Number(state.after || 0); const query = new URLSearchParams({ _limit: "50", _skip: String(skip), _fields: CLOSE_FIELDS });
  if (state.createdAfter) query.set("date_created__gte", state.createdAfter);
  const response = await closeRequest<{ data: any[]; has_more: boolean }>(secrets, `/activity/call/?${query}`);
  // Close's call list includes calls without transcription; keep these available for a later sync.
  const deferred = providerList(response.data, provider).filter(call => call.recording_transcript?.utterances?.length || call.voicemail_transcript?.utterances?.length);
  return { deferred, next: { ...state, after: String(skip + 50), complete: !response.has_more } };
}

export function normalizeFirefliesCall(raw: any): ImportedMeeting {
  const repEmail = raw.organizer_email || raw.host_email || ""; const participants = externalParticipants(raw.participants || [], repEmail);
  return normalizedMeeting({ externalId: String(raw.id || ""), title: raw.title, repEmail, repName: repEmail.split("@")[0], participants,
    prospectName: participants.find(p => p.external)?.name, createdAt: new Date(Number(raw.date) || Date.now()).toISOString(), durationSeconds: Number(raw.duration) * 60,
    recordingPageUrl: raw.transcript_url, summary: raw.summary?.overview,
    segments: (raw.sentences || []).map((turn: any) => ({ speaker: turn.speaker_name || "Unknown", text: turn.text, start: Number(turn.start_time) || 0, end: Number(turn.end_time) || undefined, timing: "provider" })),
    actionItems: String(raw.summary?.action_items || "").split("\n").filter(text => text.trim()).map((description, i) => ({ id: `fireflies_${raw.id}_${i}`, description, completed: false })) });
}

export async function fetchProviderCall(provider: CallProvider, secrets: Secrets, raw: any): Promise<ImportedMeeting | null> {
  if (provider === "zoom") return fetchZoomCall(secrets, raw);
  if (provider === "google-meet") return fetchGoogleMeetCall(secrets, raw);
  if (provider === "microsoft-teams") return fetchTeamsCall(secrets, raw);
  if (provider === "aircall") return fetchAircallCall(secrets, raw);
  if (provider === "quo") return fetchQuoCall(secrets, raw);
  const id = String(raw.id || "");
  if (!id || id.length > 200) throw new RevenueError("Provider call ID is missing.");
  if (provider === "fireflies") {
    const data = await firefliesQuery<{ transcript: any }>(secrets.token, `query($id: String!) { transcript(id: $id) { ${FIREFLIES_FIELDS} } }`, { id });
    if (!data.transcript) throw new RevenueError("Fireflies transcript is not ready yet.", 409);
    return normalizeFirefliesCall(data.transcript);
  }
  if (provider === "tldv") {
    const meeting = raw.organizer ? raw : await tldvRequest<any>(secrets, `/meetings/${encodeURIComponent(id)}`);
    const transcript = await tldvRequest<{ data: any[] }>(secrets, `/meetings/${encodeURIComponent(id)}/transcript`);
    const participants = externalParticipants(meeting.invitees || [], meeting.organizer?.email || "");
    return normalizedMeeting({ externalId: id, title: meeting.name, repName: meeting.organizer?.name, repEmail: meeting.organizer?.email, participants,
      prospectName: participants.find(p => p.external)?.name, createdAt: meeting.happenedAt, durationSeconds: meeting.duration, recordingPageUrl: meeting.url,
      segments: (transcript.data || []).map(turn => ({ speaker: turn.speaker || "Unknown", text: turn.text, start: Number(turn.startTime) || 0, end: Number(turn.endTime) || undefined, timing: "provider" })) });
  }
  if (provider === "gong") {
    const response = await gongRequest<{ callTranscripts: any[] }>(secrets, "/v2/calls/transcript", { filter: { callIds: [id] } });
    if (raw.metaData?.isPrivate === true) return null;
    const call = providerList(response.callTranscripts, "Gong").find(call => String(call.callId) === id);
    return normalizeGongCall(raw, call?.transcript || []);
  }

  const transcript = raw.recording_transcript || raw.voicemail_transcript;
  const optionalRecord = async (kind: string, ref: string | undefined): Promise<any> => {
    if (!ref) return {};
    try { return await closeRequest<any>(secrets, `/${kind}/${encodeURIComponent(ref)}/`); }
    catch (error) { if (error instanceof ProviderError && error.providerStatus === 404) return {}; throw error; }
  };
  const [rep, contact] = await Promise.all([optionalRecord("user", raw.user_id), optionalRecord("contact", raw.contact_id)]);
  const repName = [rep.first_name, rep.last_name].filter(Boolean).join(" ") || raw.user_name || "Sales Rep";
  const repEmail = rep.email || ""; const prospectEmail = contact.emails?.[0]?.email || "";
  const participants = [{ name: repName, email: repEmail, external: false }, ...(contact.name ? [{ name: contact.name, email: prospectEmail, external: true }] : [])];
  return normalizedMeeting({ externalId: id, title: `Close call · ${contact.name || repName}`, repName, repEmail, participants, prospectName: contact.name, createdAt: raw.date_created, durationSeconds: raw.duration,
    summary: transcript?.summary_text, recordingPageUrl: `https://app.close.com/lead/${encodeURIComponent(raw.lead_id || "")}/`,
    segments: (transcript?.utterances || []).map((turn: any) => ({ speaker: turn.speaker_label || "Unknown", text: turn.text, start: Number(turn.start) || 0, end: Number(turn.end) || undefined, timing: "provider" })) });
}

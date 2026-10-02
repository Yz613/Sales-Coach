import { providerRequest, providerList } from "./http";
import { externalParticipants } from "./meeting";
import { RevenueError, safeExternalUrl } from "../revenue/security";
import type { CalendarProvider, ConnectionConfig, Participant, ScheduledMeeting, SyncCursor } from "../revenue/types";

const ORIGINS = { calendly: "https://api.calendly.com", "google-calendar": "https://www.googleapis.com", "outlook-calendar": "https://graph.microsoft.com" };
export function calendarRequest<T>(provider: CalendarProvider, token: string, path: string) {
  return providerRequest<T>(provider, ORIGINS[provider], path, { Authorization: `Bearer ${token}` });
}
export async function verifyCalendarProvider(provider: CalendarProvider, token: string): Promise<Partial<ConnectionConfig>> {
  if (provider === "calendly") {
    const result = await calendarRequest<any>(provider, token, "/users/me");
    if (typeof result.resource?.uri !== "string" || !/^https:\/\/api\.calendly\.com\/users\/[A-Za-z0-9_-]+$/.test(result.resource.uri)) throw new RevenueError("Calendly returned an invalid user account.", 502);
    await calendarRequest(provider, token, `/scheduled_events?${new URLSearchParams({ user: result.resource.uri, count: "1" })}`);
    return { userUri: result.resource.uri, accountEmail: result.resource.email || "" };
  }
  if (provider === "google-calendar") {
    const result = await calendarRequest<any>(provider, token, "/calendar/v3/calendars/primary");
    await calendarRequest(provider, token, "/calendar/v3/calendars/primary/events?maxResults=1");
    return { calendarId: "primary", accountEmail: result.id || "" };
  }
  const user = await calendarRequest<any>(provider, token, "/v1.0/me?$select=mail,userPrincipalName");
  await calendarRequest(provider, token, "/v1.0/me/events?$top=1&$select=id");
  return { accountEmail: user.mail || user.userPrincipalName || "" };
}
function iso(value: unknown) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) throw new RevenueError("The calendar returned an invalid meeting time.", 502);
  return new Date(value).toISOString();
}
function normalize(input: ScheduledMeeting): ScheduledMeeting {
  if (!input.externalId || input.externalId.length > 512) throw new RevenueError("The calendar returned an invalid meeting ID.", 502);
  return { ...input, title: String(input.title || "Scheduled meeting").slice(0, 500), startAt: iso(input.startAt), endAt: iso(input.endAt), sourceUrl: safeExternalUrl(input.sourceUrl) };
}
function calendarParticipants(people: any[], ownerEmail: string) {
  const participants = externalParticipants(people, ownerEmail);
  // Shared consumer email domains do not identify a single employer.
  if (["gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "yahoo.com", "icloud.com", "me.com", "aol.com", "proton.me", "protonmail.com"].includes(ownerEmail.split("@")[1]?.toLowerCase())) {
    return participants.map(person => ({ ...person, external: Boolean(person.email?.includes("@") && person.email.toLowerCase() !== ownerEmail.toLowerCase()) }));
  }
  return participants;
}
export function normalizeGoogleEvent(raw: any, ownerEmail: string): ScheduledMeeting {
  return normalize({ externalId: raw.id, title: raw.summary, startAt: raw.start?.dateTime || `${raw.start?.date}T00:00:00Z`, endAt: raw.end?.dateTime || `${raw.end?.date}T00:00:00Z`,
    status: raw.status === "cancelled" ? "cancelled" : "scheduled", organizerEmail: raw.organizer?.email || ownerEmail,
    participants: calendarParticipants((raw.attendees || []).map((a: any) => ({ name: a.displayName || a.email, email: a.email })), ownerEmail),
    location: String(raw.location || raw.hangoutLink || ""), sourceUrl: raw.htmlLink });
}
export function normalizeOutlookEvent(raw: any, ownerEmail: string): ScheduledMeeting {
  // calendarView is explicitly requested in UTC; timestamps may omit their Z suffix.
  const utc = (value: string) => value && !/(Z|[+-]\d\d:\d\d)$/i.test(value) ? `${value}Z` : value;
  return normalize({ externalId: raw.id, title: raw.subject, startAt: utc(raw.start?.dateTime), endAt: utc(raw.end?.dateTime), status: raw.isCancelled ? "cancelled" : "scheduled",
    organizerEmail: raw.organizer?.emailAddress?.address || ownerEmail,
    participants: calendarParticipants((raw.attendees || []).map((a: any) => ({ name: a.emailAddress?.name, email: a.emailAddress?.address })), ownerEmail),
    location: String(raw.location?.displayName || raw.onlineMeeting?.joinUrl || ""), sourceUrl: raw.webLink });
}
export function normalizeCalendlyEvent(raw: any, invitees: any[] = []): ScheduledMeeting {
  const host = raw.event_memberships?.[0] || {}; const hostEmail = host.user_email || "";
  const participants: Participant[] = [...(raw.event_memberships || []).map((member: any) => ({ name: member.user_name || member.user_email || "Host", email: member.user_email, external: false })),
    ...invitees.map(invitee => ({ name: invitee.name || invitee.email || "Invitee", email: invitee.email, external: true }))];
  return normalize({ externalId: calendlyEventId(raw.uri), title: raw.name, startAt: raw.start_time, endAt: raw.end_time,
    status: raw.status === "canceled" ? "cancelled" : "scheduled", organizerEmail: hostEmail, participants,
    location: String(raw.location?.join_url || raw.location?.location || raw.location?.type || ""), sourceUrl: raw.location?.join_url || "https://calendly.com/app/scheduled_events/user/me" });
}
export function calendlyEventId(uri: unknown): string {
  if (typeof uri !== "string" || !/^https:\/\/api\.calendly\.com\/scheduled_events\/[A-Za-z0-9_-]+$/.test(uri)) throw new RevenueError("Invalid Calendly event reference.");
  return uri.split("/").at(-1)!;
}
export function graphPagePath(value: string): string {
  const url = new URL(value, ORIGINS["outlook-calendar"]);
  if (url.origin !== ORIGINS["outlook-calendar"] || url.username || url.password || url.hash || url.pathname !== "/v1.0/me/calendarView") throw new RevenueError("Microsoft returned an invalid calendar page.", 502);
  return url.pathname + url.search;
}

/** Assumption: bounded snapshots are sufficient for meeting context; calendars never create transcript calls. */
export async function calendarProviderPage(provider: CalendarProvider, token: string, config: ConnectionConfig, state: SyncCursor) {
  const base = Date.parse(state.syncStartedAt || new Date().toISOString());
  const nextState = { ...state, windowStart: state.windowStart || new Date(base - (state.full ? 730 : 180) * 86400000).toISOString(), windowEnd: state.windowEnd || new Date(base + 90 * 86400000).toISOString() };
  if (provider === "calendly") {
    if (!config.userUri) throw new RevenueError("Reconnect Calendly to verify the account.");
    const query = new URLSearchParams({ user: config.userUri, min_start_time: nextState.windowStart, max_start_time: nextState.windowEnd, count: "100", sort: "start_time:asc" });
    if (state.after) query.set("page_token", state.after);
    const result = await calendarRequest<any>(provider, token, `/scheduled_events?${query}`);
    if (!Array.isArray(result.collection)) throw new RevenueError("Calendly returned an invalid event list. Retry sync.", 502);
    return { meetings: [] as ScheduledMeeting[], deferred: result.collection, next: { ...nextState, after: result.pagination?.next_page_token, complete: !result.pagination?.next_page_token } };
  }
  if (provider === "google-calendar") {
    const query = new URLSearchParams({ timeMin: nextState.windowStart, timeMax: nextState.windowEnd, maxResults: "100", singleEvents: "true", showDeleted: "false", orderBy: "startTime" });
    if (state.after) query.set("pageToken", state.after);
    const result = await calendarRequest<any>(provider, token, `/calendar/v3/calendars/${encodeURIComponent(config.calendarId || "primary")}/events?${query}`);
    // Call context needs a timed meeting; all-day reminders and absence entries are excluded.
    return { meetings: providerList(result.items, "Google Calendar", result.kind === "calendar#events").filter((raw: any) => raw.start?.dateTime).map((raw: any) => normalizeGoogleEvent(raw, config.accountEmail || "")), deferred: [], next: { ...nextState, after: result.nextPageToken, complete: !result.nextPageToken } };
  }
  const query = new URLSearchParams({ startDateTime: nextState.windowStart, endDateTime: nextState.windowEnd, "$top": "100" });
  const path = state.after ? graphPagePath(state.after) : `/v1.0/me/calendarView?${query}`;
  const result = await providerRequest<any>(provider, ORIGINS[provider], path, { Authorization: `Bearer ${token}`, Prefer: 'outlook.timezone="UTC", IdType="ImmutableId"' });
  if (!Array.isArray(result.value)) throw new RevenueError("Microsoft returned an invalid event list. Retry sync.", 502);
  return { meetings: result.value.filter((raw: any) => !raw.isAllDay).map((raw: any) => normalizeOutlookEvent(raw, config.accountEmail || "")), deferred: [], next: { ...nextState, after: result["@odata.nextLink"] ? graphPagePath(result["@odata.nextLink"]) : undefined, complete: !result["@odata.nextLink"] } };
}
export async function fetchCalendlyMeeting(token: string, raw: any): Promise<ScheduledMeeting> {
  const id = calendlyEventId(raw.uri); const invitees: any[] = []; let after: string | undefined;
  // One event has a bounded invitee list; large group events fail visibly rather than silently dropping people.
  for (let page = 0; page < 20; page++) {
    const query = new URLSearchParams({ count: "100" }); if (after) query.set("page_token", after);
    const response = await calendarRequest<any>("calendly", token, `/scheduled_events/${id}/invitees?${query}`);
    if (!Array.isArray(response.collection)) throw new RevenueError("Calendly returned an invalid invitee list. Retry sync.", 502);
    invitees.push(...response.collection.filter((invitee: any) => invitee.status !== "canceled")); after = response.pagination?.next_page_token;
    if (!after) return normalizeCalendlyEvent(raw, invitees);
  }
  throw new RevenueError("This Calendly meeting exceeds 2,000 invitees. Narrow the event before importing it.");
}

import { formatClock } from "../audio";
import { RevenueError, safeExternalUrl, textInput } from "../revenue/security";
import type { ImportedMeeting, Participant, Segment } from "../revenue/types";

export function normalizedMeeting(input: Partial<ImportedMeeting> & { externalId: string }): ImportedMeeting {
  const externalId = textInput(input.externalId, "Source call ID", 200);
  const segments = (input.segments || []).filter(turn => typeof turn.text === "string" && turn.text.trim())
    .map(turn => ({ ...turn, text: turn.text.trim(), start: Number.isFinite(turn.start) ? Math.max(0, turn.start) : 0 }))
    .sort((a, b) => a.start - b.start);
  const transcriptText = input.transcriptText?.trim() || segments.map(turn => `[${formatClock(turn.start)}] ${turn.speaker}: ${turn.text}`).join("\n");
  if (!transcriptText) throw new RevenueError("Transcript is not ready yet. The call will be retried.", 409);
  const durationSeconds = Math.max(1, Math.ceil(Number(input.durationSeconds) || segments.at(-1)?.end || (segments.at(-1)?.start || 0) + 5));
  segments.forEach((turn, i) => { turn.end = Math.max(turn.start, turn.end ?? segments[i + 1]?.start ?? durationSeconds); });
  const createdAt = input.createdAt && Number.isFinite(Date.parse(input.createdAt)) ? new Date(input.createdAt).toISOString() : new Date().toISOString();
  return { externalId, title: input.title || "Imported call", repName: input.repName || "Sales Rep", repEmail: input.repEmail || "",
    prospectName: input.prospectName || "Prospect", prospectCompany: input.prospectCompany || "", durationSeconds, transcriptText, createdAt,
    recordingPageUrl: safeExternalUrl(input.recordingPageUrl), participants: input.participants || [], segments, summary: input.summary || "",
    actionItems: input.actionItems || [], crmMatches: input.crmMatches || (input.participants || []).filter(p => p.external && p.email).map(p => ({ kind: "contact", email: p.email })) };
}

export function externalParticipants(people: any[], ownerEmail: string): Participant[] {
  const domain = ownerEmail.split("@")[1]?.toLowerCase();
  return people.map(person => {
    const email = String(typeof person === "string" ? person : person.email || "");
    return { name: String(typeof person === "string" ? person : person.name || person.fullName || email || "Participant"), email,
      external: Boolean(domain && email.includes("@") && email.split("@")[1].toLowerCase() !== domain) };
  });
}

/** A small, documented payload for incoming Zapier/Make transcript feeds. */
export function normalizeAutomationMeeting(body: any): ImportedMeeting {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new RevenueError("Send a call JSON object.");
  const externalId = textInput(body.externalId, "Source call ID", 200);
  const transcriptText = textInput(body.transcriptText || "", "Transcript", 1500000, false);
  const segments: Segment[] = body.segments === undefined ? [] : (() => {
    if (!Array.isArray(body.segments) || body.segments.length > 20000) throw new RevenueError("Segments must be an array of transcript turns.");
    return body.segments.map((turn: any) => {
      if (typeof turn.start !== "number" || !Number.isFinite(turn.start) || turn.start < 0 || (turn.end !== undefined && (typeof turn.end !== "number" || !Number.isFinite(turn.end) || turn.end < turn.start))) throw new RevenueError("Transcript timestamps must be seconds, with end after start.");
      return { speaker: textInput(turn.speaker || "Unknown", "Speaker", 200), text: textInput(turn.text, "Transcript turn", 100000), start: turn.start, end: turn.end, timing: "provider" as const };
    });
  })();
  if (body.createdAt !== undefined && (typeof body.createdAt !== "string" || !Number.isFinite(Date.parse(body.createdAt)))) throw new RevenueError("createdAt must be a valid date.");
  if (body.durationSeconds !== undefined && (typeof body.durationSeconds !== "number" || !Number.isFinite(body.durationSeconds) || body.durationSeconds < 0 || body.durationSeconds > 86400)) throw new RevenueError("durationSeconds must be between 0 and 86400.");
  return normalizedMeeting({ externalId, transcriptText, segments, createdAt: body.createdAt, durationSeconds: body.durationSeconds,
    title: textInput(body.title || "Imported call", "Call title", 200), repName: textInput(body.repName || "Sales Rep", "Rep name", 200),
    repEmail: textInput(body.repEmail || "", "Rep email", 320, false), prospectName: textInput(body.prospectName || "Prospect", "Prospect name", 200),
    prospectCompany: textInput(body.prospectCompany || "", "Company", 200, false), recordingPageUrl: safeExternalUrl(body.recordingPageUrl), summary: textInput(body.summary || "", "Summary", 100000, false) });
}

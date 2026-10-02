import { normalizedMeeting } from "./meeting";
import { stableId } from "../revenue/security";
import type { ActionItem, ImportedMeeting, Segment } from "../revenue/types";

// Current Gong extensive API; legacy pointsOfInterest action items were removed in 2025.
export const GONG_CONTENT_SELECTOR = {
  context: "Extended", contextTiming: ["Now", "TimeOfCall"],
  exposedFields: { parties: true, content: { brief: true, highlights: true, keyPoints: true, outline: true, topics: true, trackers: true, trackerOccurrences: true, callOutcome: true },
    interaction: { speakers: true, personInteractionStats: true, questions: true } },
};

function trackerOccurrences(tracker: any) {
  const phrases = (tracker.phrases || []).flatMap((phrase: any) => (phrase.occurrences || []).map((o: any) => ({ start: Number(o.startTime), phrase: String(phrase.phrase || tracker.name || "Tracker") })));
  const general = (tracker.occurrences || []).filter((o: any) => !phrases.some((p: any) => p.start === Number(o.startTime)))
    .map((o: any) => ({ start: Number(o.startTime), phrase: String(o.phrase || tracker.name || "Tracker") }));
  return [...phrases, ...general].filter(o => Number.isFinite(o.start) && o.start >= 0).sort((a, b) => a.start - b.start);
}

export function normalizeGongCall(raw: any, transcript: any[], existing?: { segments: Segment[]; transcriptText: string }): ImportedMeeting {
  const id = String(raw.metaData?.id || raw.id || "");
  const parties = Array.isArray(raw.parties) ? raw.parties : [];
  const rep = parties.find((p: any) => p.affiliation === "Internal" && String(p.userId) === String(raw.metaData?.primaryUserId)) || parties.find((p: any) => p.affiliation === "Internal") || {};
  const participants = parties.map((p: any) => ({ name: p.name || p.emailAddress || "Participant", email: p.emailAddress, external: p.affiliation === "External" }));
  const segments = transcript.flatMap((turn: any) => {
    const speaker = parties.find((p: any) => String(p.speakerId) === String(turn.speakerId));
    return (turn.sentences || []).map((s: any) => ({ speaker: speaker?.name || speaker?.emailAddress || `Speaker ${turn.speakerId}`, text: s.text, start: Number(s.start) / 1000, end: Number(s.end) / 1000, timing: "provider" as const }));
  });
  const content = raw.content || {};
  const highlights = (content.highlights || []).map((section: any) => ({ title: String(section.title || "Highlights"), items: (section.items || []).filter((i: any) => typeof i.text === "string" && i.text.trim()).map((i: any) => ({ text: i.text.trim(), times: (i.startTimes || []).filter((t: unknown) => typeof t === "number" && Number.isFinite(t) && t >= 0) })) }));
  const actionItems: ActionItem[] = highlights.filter((s: any) => /^next[\s_-]*steps?$/i.test(s.title.trim())).flatMap((s: any) => s.items.map((i: any) => ({ id: `gong_${stableId(id, i.text)}`, description: i.text, completed: false, ...(i.times.length ? { timestamp: i.times[0] } : {}) })));
  const context = [...(raw.context || []), ...parties.flatMap((p: any) => p.context || [])];
  const crmMatches = context.flatMap((c: any) => (c.objects || []).flatMap((o: any) => {
    const kind = ({ opportunity: "deal", deal: "deal", account: "company", company: "company", contact: "contact", lead: "contact" } as Record<string, string>)[String(o.objectType).toLowerCase()];
    const provider = ({ HubSpot: "hubspot", Salesforce: "salesforce", MicrosoftDynamic: "dynamics" } as Record<string, string>)[c.system];
    const name = (o.fields || []).find((f: any) => /^(name|dealname)$/i.test(f.name))?.value;
    return kind && provider && o.objectId ? [{ kind, provider, externalId: String(o.objectId), ...(typeof name === "string" ? { name } : {}) }] : [];
  }));
  crmMatches.push(...participants.filter((p: any) => p.external && p.email).map((p: any) => ({ kind: "contact", email: p.email })));
  return normalizedMeeting({ externalId: id, title: raw.metaData?.title, repName: rep.name, repEmail: rep.emailAddress, participants,
    prospectName: participants.find((p: any) => p.external)?.name, prospectCompany: crmMatches.find((m: any) => m.kind === "company" && m.name)?.name,
    createdAt: raw.metaData?.started, durationSeconds: raw.metaData?.duration, recordingPageUrl: raw.metaData?.url, segments: existing?.segments || segments, transcriptText: existing?.transcriptText,
    summary: content.brief || (content.keyPoints || []).map((p: any) => p.text).filter(Boolean).join("\n"), actionItems: [...new Map(actionItems.map(a => [a.id, a])).values()], crmMatches,
    providerInsights: { highlights, keyPoints: (content.keyPoints || []).map((p: any) => String(p.text || "")).filter(Boolean),
      outline: (content.outline || []).map((s: any) => ({ title: String(s.section || "Section"), start: Number(s.startTime) || 0, items: (s.items || []).map((i: any) => String(i.text || "")) })),
      topics: (content.topics || []).map((t: any) => ({ name: String(t.name || "Topic"), duration: Number(t.duration) || 0 })),
      trackers: (content.trackers || []).map((t: any) => ({ name: String(t.name || "Tracker"), occurrences: trackerOccurrences(t) })),
      metrics: [...(raw.interaction?.interactionStats || []), ...([ ["Company questions", raw.interaction?.questions?.companyCount], ["Customer questions", raw.interaction?.questions?.nonCompanyCount] ] as const).map(([name, value]) => ({ name, value }))]
        .filter((m: any) => typeof m.name === "string" && typeof m.value === "number" && Number.isFinite(m.value)).map((m: any) => ({ name: m.name, value: m.value })),
      speakers: (raw.interaction?.speakers || []).map((s: any) => {
        // Speaker statistics reference the participant ID; transcripts reference speakerId.
        const party = parties.find((p: any) => s.id != null && p.id != null && String(p.id) === String(s.id))
          || parties.find((p: any) => s.userId != null && p.userId != null && String(p.userId) === String(s.userId))
          || parties.find((p: any) => s.id != null && p.speakerId != null && String(p.speakerId) === String(s.id));
        return { name: party?.name || party?.emailAddress || `Speaker ${s.id}`, seconds: Number(s.talkTime) || 0 };
      }),
      outcome: typeof content.callOutcome?.name === "string" ? content.callOutcome.name : "" },
  });
}

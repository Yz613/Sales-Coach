export type TaskProvider = "asana" | "notion" | "trello" | "clickup" | "monday" | "linear" | "todoist" | "airtable" | "github" | "gitlab";
export type ProviderId = TaskProvider | "discord" | "fathom" | "fireflies" | "tldv" | "gong" | "close" | "hubspot" | "pipedrive" | "attio" | "zapier" | "make" | "slack" | "calendly" | "google-calendar" | "outlook-calendar" | "aircall" | "zoom" | "gmail" | "outlook" | "quo";
export interface ExternalTask { externalId: string; title: string; description: string; status: "open" | "completed" | "archived"; assignee: string; dueAt: string | null; sourceUrl: string | null }
export type CalendarProvider = "calendly" | "google-calendar" | "outlook-calendar";
export type MailboxProvider = "gmail" | "outlook";
export interface ScheduledMeeting {
  externalId: string; title: string; startAt: string; endAt: string; status: "scheduled" | "cancelled";
  organizerEmail: string; participants: Participant[]; location: string; sourceUrl: string | null;
}
export interface Participant { name: string; email?: string; external?: boolean }
export interface Segment { speaker: string; email?: string; text: string; start: number; end?: number; timing: "provider" | "estimated" }
export interface ActionItem { id: string; description: string; completed: boolean; assignee?: string; timestamp?: number }
export interface ImportedMeeting {
  externalId: string; title: string; repName: string; repEmail: string; prospectName: string; prospectCompany: string;
  durationSeconds: number; transcriptText: string; createdAt: string; recordingPageUrl: string | null;
  participants: Participant[]; segments: Segment[]; summary: string; actionItems: ActionItem[];
  crmMatches: { kind: string; externalId?: string; email?: string; phone?: string; name?: string; provider?: string }[];
  providerInsights?: ProviderInsights;
}
export interface ProviderInsights {
  highlights: { title: string; items: { text: string; times: number[] }[] }[];
  keyPoints: string[]; outline: { title: string; start: number; items: string[] }[];
  topics: { name: string; duration: number }[]; trackers: { name: string; occurrences: { start: number; phrase: string }[] }[];
  metrics: { name: string; value: number }[]; speakers: { name: string; seconds: number }[]; outcome: string;
}
export interface SyncCursor { kind?: number; after?: string; pageCount?: number; createdAfter?: string; syncStartedAt?: string; windowStart?: string; windowEnd?: string; hostEmail?: string; hostName?: string; stages?: Record<string, { label: string; closed: boolean }>; complete?: boolean; full?: boolean }
export const HUBSPOT_PROPERTY_FIELDS = ["summary", "score", "nextSteps", "forecastCategory"] as const;
export type HubspotPropertyField = typeof HUBSPOT_PROPERTY_FIELDS[number];
export interface HubspotPropertyMapping { source: HubspotPropertyField; object: "deal" | "contact"; property: string }
export interface ConnectionConfig { autoSync: boolean; autoEvaluate: boolean; defaultStage: string; webhookId?: string; webhookUrl?: string; webhookError?: string; lastWebhookAt?: string; portalId?: string;
  calendarId?: string; userUri?: string; accountEmail?: string; accountName?: string; notifyReviewed?: boolean; notifyClips?: boolean; notifyLowScore?: boolean; lowScoreThreshold?: number; lastNotifiedAt?: string;
  targetLabel?: string; titleProperty?: string; pendingSetup?: boolean; pendingAutoSync?: boolean; authMethod?: "oauth"; ownerUserId?: string;
  exportReviewed?: boolean; outboundConfigured?: boolean; outboundOnImported?: boolean; outboundOnReviewed?: boolean;
  propertyMappings?: HubspotPropertyMapping[]; writePropertiesOnReview?: boolean;
}
export interface CrmRecord {
  id: string; connectionId: string; provider: string; externalId: string; kind: string; name: string;
  email: string | null; domain: string | null; stage: string | null; pipeline: string | null;
  amount: string | null; currency: string | null; owner: string | null; closeDate: string | null; closed: boolean;
  associations: string[]; properties: Record<string, string | null>; sourceUrl: string | null; syncedAt: string;
}
export interface ConversationFilters { q?: string; repId?: string; stage?: string; source?: string; from?: string; to?: string; reviewed?: string; tracker?: string; aiTracker?: string; page?: number }
export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  try { return value ? JSON.parse(value) as T : fallback; } catch { return fallback; }
}

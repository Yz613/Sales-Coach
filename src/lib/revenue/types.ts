export type ProviderId = "fathom" | "fireflies" | "tldv" | "gong" | "close" | "hubspot" | "pipedrive" | "attio" | "zapier" | "make";
export interface Participant { name: string; email?: string; external?: boolean }
export interface Segment { speaker: string; email?: string; text: string; start: number; end?: number; timing: "provider" | "estimated" }
export interface ActionItem { id: string; description: string; completed: boolean; assignee?: string; timestamp?: number }
export interface ImportedMeeting {
  externalId: string; title: string; repName: string; repEmail: string; prospectName: string; prospectCompany: string;
  durationSeconds: number; transcriptText: string; createdAt: string; recordingPageUrl: string | null;
  participants: Participant[]; segments: Segment[]; summary: string; actionItems: ActionItem[];
  crmMatches: { kind: string; externalId?: string; email?: string; name?: string; provider?: string }[];
}
export interface SyncCursor { kind?: number; after?: string; createdAfter?: string; syncStartedAt?: string; stages?: Record<string, { label: string; closed: boolean }>; complete?: boolean; full?: boolean }
export interface ConnectionConfig { autoSync: boolean; autoEvaluate: boolean; defaultStage: string; webhookId?: string; webhookUrl?: string; webhookError?: string; lastWebhookAt?: string; portalId?: string }
export interface CrmRecord {
  id: string; connectionId: string; provider: string; externalId: string; kind: string; name: string;
  email: string | null; domain: string | null; stage: string | null; pipeline: string | null;
  amount: string | null; currency: string | null; owner: string | null; closeDate: string | null; closed: boolean;
  associations: string[]; properties: Record<string, string | null>; sourceUrl: string | null; syncedAt: string;
}
export interface ConversationFilters { q?: string; repId?: string; stage?: string; source?: string; from?: string; to?: string; reviewed?: string; tracker?: string; page?: number }
export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  try { return value ? JSON.parse(value) as T : fallback; } catch { return fallback; }
}

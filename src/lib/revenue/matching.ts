import type { ImportedMeeting } from "./types";

export function matchesCrmRecord(record: { kind: string; provider: string; externalId: string; email: string | null }, match: ImportedMeeting["crmMatches"][number]): boolean {
  if (record.kind !== match.kind) return false;
  // Legacy stored source IDs came from HubSpot. Numeric IDs are not portable across CRMs.
  const matchesId = Boolean(match.externalId && record.provider === (match.provider || "hubspot") && record.externalId === match.externalId);
  const matchesEmail = Boolean(match.email && record.email?.toLowerCase() === match.email.toLowerCase());
  return matchesId || matchesEmail;
}

import type { ImportedMeeting } from "./types";

/** Accept an already dialable number, a 10-digit NANP number, or a country-code digit string. */
export function normalizeE164(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (/^\+[1-9]\d{1,14}$/.test(trimmed)) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}

function addPhone(phones: Set<string>, value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) { parsed.forEach(item => addPhone(phones, item)); return; }
      } catch { /* Treat the text as one number. */ }
    }
    if (trimmed.includes(",")) { trimmed.split(",").forEach(part => addPhone(phones, part)); return; }
    const phone = normalizeE164(trimmed);
    if (phone) phones.add(phone);
    return;
  }
  if (Array.isArray(value)) { value.forEach(item => addPhone(phones, item)); return; }
  if (value && typeof value === "object") addPhone(phones, (value as { value?: unknown; phone_number?: unknown; original_phone_number?: unknown }).value || (value as { phone_number?: unknown }).phone_number || (value as { original_phone_number?: unknown }).original_phone_number);
}

export function phonesFromRecord(record: { properties?: unknown }): string[] {
  let properties = record.properties;
  if (typeof properties === "string") { try { properties = JSON.parse(properties); } catch { properties = {}; } }
  if (!properties || typeof properties !== "object") return [];
  const phones = new Set<string>();
  for (const key of ["phone", "mobilephone", "phones", "phoneNumbers", "phone_numbers"]) addPhone(phones, (properties as Record<string, unknown>)[key]);
  return [...phones];
}

function associationIds(value: unknown): string[] {
  let associations = value;
  if (typeof associations === "string") { try { associations = JSON.parse(associations); } catch { associations = []; } }
  return Array.isArray(associations) ? associations.map(id => String(id)) : [];
}

type LinkRecord = { id: string; kind: string; provider: string; externalId: string; email: string | null; properties?: unknown; associations?: unknown };

export function matchesCrmRecord(record: { kind: string; provider: string; externalId: string; email: string | null; properties?: unknown }, match: ImportedMeeting["crmMatches"][number]): boolean {
  if (record.kind !== match.kind) return false;
  // Legacy stored source IDs came from HubSpot. Numeric IDs are not portable across CRMs.
  const matchesId = Boolean(match.externalId && record.provider === (match.provider || "hubspot") && record.externalId === match.externalId);
  const matchesEmail = Boolean(match.email && record.email?.toLowerCase() === match.email.toLowerCase());
  const phone = normalizeE164(match.phone || "");
  const matchesPhone = record.kind === "contact" && Boolean(phone && phonesFromRecord(record).includes(phone));
  return matchesId || matchesEmail || matchesPhone;
}

/** Keep prior links, add matched contacts, and include deals associated with those contacts. */
export function crmLinkIds(records: LinkRecord[], matches: ImportedMeeting["crmMatches"], extraEmails: string[], previousIds: string[] = []): string[] {
  const emails = extraEmails.map(email => email.toLowerCase());
  const direct = records.filter(record => matches.some(match => matchesCrmRecord(record, match)) || (record.kind === "contact" && record.email && emails.includes(record.email.toLowerCase())));
  const contactIds = new Set(direct.filter(record => record.kind === "contact").map(record => record.id));
  for (const id of previousIds) if (records.some(record => record.id === id && record.kind === "contact")) contactIds.add(id);
  const dealIds = records.filter(record => record.kind === "deal" && associationIds(record.associations).some(id => contactIds.has(id))).map(record => record.id);
  return [...new Set([...previousIds, ...direct.map(record => record.id), ...dealIds])];
}

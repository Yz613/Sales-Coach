import { and, desc, eq, lt, sql } from "drizzle-orm";
import { db } from "../db";
import { crmRecords, emailMessages } from "../db/schema";
import { getSetting, setSetting } from "../db/service";
import type { AuthUser } from "../auth";
import { currentTenantId } from "../tenant";
import { providerRequest } from "./http";
import { RevenueError, stableId } from "../revenue/security";
import { parseJson, type ConnectionConfig, type MailboxProvider, type SyncCursor } from "../revenue/types";

export const EMAIL_SNIPPET_LIMIT = 280;
const CONSUMER_DOMAINS = new Set(["gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "yahoo.com", "icloud.com", "me.com", "aol.com", "proton.me", "protonmail.com"]);
const GMAIL_ORIGIN = "https://gmail.googleapis.com";
const GRAPH_ORIGIN = "https://graph.microsoft.com";

export interface MailParticipant {
  name: string;
  email: string;
  role: "from" | "to" | "cc";
}

export interface EmailActivity {
  id: string;
  connectionId: string;
  provider: MailboxProvider;
  externalId: string;
  threadId: string;
  ownerUserId: string;
  direction: "inbound" | "outbound";
  subject: string;
  snippet: string;
  participants: MailParticipant[];
  sentAt: string;
  dealIds: string[];
  accountIds: string[];
  accountNames: string[];
}

interface MailRecord {
  id: string;
  kind: string;
  email: string | null;
  domain: string | null;
  associations: string[];
}

export interface MailMatch {
  dealIds: string[];
  accountIds: string[];
}

/** Shared consumer domains never identify an account. Exact contact addresses still match. */
export function normalizeDomain(value: unknown): string {
  const domain = String(value || "").trim().toLowerCase().replace(/^@/, "").replace(/^www\./, "");
  if (!domain || domain.length > 253 || /[\s/\\]/.test(domain) || !domain.includes(".")) return "";
  return domain;
}

export function emailDomain(email: string): string {
  const domain = normalizeDomain(email.split("@")[1] || "");
  return domain;
}

export function clipSnippet(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, EMAIL_SNIPPET_LIMIT);
}

export function parseAddresses(value: unknown): { name: string; email: string }[] {
  const text = String(value || "");
  const found: { name: string; email: string }[] = [];
  const seen = new Set<string>();
  const angled = /(?:"?([^"<]*?)"?\s*)?<([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})>/gi;
  let match: RegExpExecArray | null;
  while ((match = angled.exec(text)) && found.length < 30) {
    const email = match[2].toLowerCase();
    if (seen.has(email)) continue;
    seen.add(email);
    found.push({ name: (match[1] || "").trim().slice(0, 200), email });
  }
  const bare = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  while ((match = bare.exec(text)) && found.length < 30) {
    const email = match[0].toLowerCase();
    if (seen.has(email)) continue;
    seen.add(email);
    found.push({ name: "", email });
  }
  return found;
}

export function parseExcludedDomains(value: unknown): string[] {
  let raw = "";
  if (Array.isArray(value)) raw = value.join("\n");
  else if (typeof value === "string" && value.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(value);
      raw = Array.isArray(parsed) ? parsed.join("\n") : value;
    } catch { raw = value; }
  } else raw = String(value || "");
  const domains = raw.split(/[\s,;]+/).map(normalizeDomain).filter(Boolean);
  return [...new Set(domains)].slice(0, 50);
}

export async function emailCaptureSettings(): Promise<{ enabled: boolean; excludedDomains: string[] }> {
  const enabled = (await getSetting("email_capture_enabled")) === "1";
  return { enabled, excludedDomains: parseExcludedDomains(await getSetting("email_excluded_domains")) };
}

export async function emailCaptureEnabled(): Promise<boolean> {
  return (await emailCaptureSettings()).enabled;
}

export async function saveEmailCaptureSettings(input: { enabled?: unknown; domains?: unknown }) {
  if (input.enabled !== undefined) {
    if (typeof input.enabled !== "boolean") throw new RevenueError("Choose whether email capture is on or off.");
    await setSetting("email_capture_enabled", input.enabled ? "1" : "0");
  }
  if (input.domains !== undefined) {
    const raw = Array.isArray(input.domains) ? input.domains.join("\n") : String(input.domains || "");
    const requested = raw.split(/[\s,;]+/).map(part => part.trim()).filter(Boolean);
    if (requested.length > 50) throw new RevenueError("Exclude at most 50 domains.");
    const domains = requested.map(normalizeDomain);
    if (domains.some(domain => !domain)) throw new RevenueError("Excluded domains must look like company.com.");
    await setSetting("email_excluded_domains", JSON.stringify([...new Set(domains)]));
  }
}

/** Managers and admins see every mailbox. Reps see messages from the mailbox they connected. */
export function filterEmailsForViewer<T extends { ownerUserId: string }>(auth: Pick<AuthUser, "isAdmin" | "userId">, emails: T[]): T[] {
  if (auth.isAdmin) return emails;
  const owner = auth.userId || "";
  if (!owner) return [];
  return emails.filter(email => email.ownerUserId === owner);
}

export function buildMailIndex(records: MailRecord[], excludedDomains: string[]) {
  const excluded = new Set(excludedDomains.map(normalizeDomain).filter(Boolean));
  const dealsByRecord = new Map<string, Set<string>>();
  for (const record of records) {
    if (record.kind !== "deal") continue;
    for (const id of record.associations) {
      const deals = dealsByRecord.get(id) || new Set<string>();
      deals.add(record.id);
      dealsByRecord.set(id, deals);
    }
  }
  const emailDeals = new Map<string, Set<string>>();
  const domainAccounts = new Map<string, { accountIds: Set<string>; dealIds: Set<string> }>();
  for (const record of records) {
    if (record.kind === "contact" && record.email) {
      const email = record.email.trim().toLowerCase();
      const domain = emailDomain(email);
      if (!email.includes("@") || (domain && excluded.has(domain))) continue;
      const deals = emailDeals.get(email) || new Set<string>();
      for (const dealId of dealsByRecord.get(record.id) || []) deals.add(dealId);
      if (deals.size) emailDeals.set(email, deals);
    }
    if (record.kind === "company") {
      const domain = normalizeDomain(record.domain);
      if (!domain || excluded.has(domain) || CONSUMER_DOMAINS.has(domain)) continue;
      const entry = domainAccounts.get(domain) || { accountIds: new Set<string>(), dealIds: new Set<string>() };
      entry.accountIds.add(record.id);
      for (const dealId of dealsByRecord.get(record.id) || []) entry.dealIds.add(dealId);
      domainAccounts.set(domain, entry);
    }
  }
  return {
    match(participants: { email: string }[]): MailMatch | null {
      const dealIds = new Set<string>();
      const accountIds = new Set<string>();
      for (const person of participants) {
        const email = person.email.trim().toLowerCase();
        const domain = emailDomain(email);
        if (!email || (domain && excluded.has(domain))) continue;
        for (const dealId of emailDeals.get(email) || []) dealIds.add(dealId);
        const account = domain ? domainAccounts.get(domain) : undefined;
        if (account) {
          for (const id of account.accountIds) accountIds.add(id);
          for (const dealId of account.dealIds) dealIds.add(dealId);
        }
      }
      if (!dealIds.size && !accountIds.size) return null;
      return { dealIds: [...dealIds], accountIds: [...accountIds] };
    },
  };
}

function directionFor(participants: MailParticipant[], ownerEmail: string): "inbound" | "outbound" {
  const from = participants.find(person => person.role === "from")?.email.toLowerCase() || "";
  return from && from === ownerEmail.trim().toLowerCase() ? "outbound" : "inbound";
}

function headerMap(headers: { name?: string; value?: string }[] | undefined) {
  const map = new Map<string, string>();
  for (const header of headers || []) {
    const name = String(header.name || "").toLowerCase();
    if (name && !map.has(name)) map.set(name, String(header.value || ""));
  }
  return map;
}

export function normalizeGmailMessage(raw: any, ownerEmail: string): Omit<EmailActivity, "id" | "connectionId" | "ownerUserId" | "dealIds" | "accountIds" | "accountNames"> | null {
  const externalId = String(raw?.id || "");
  if (!/^[A-Za-z0-9]+$/.test(externalId)) return null;
  const headers = headerMap(raw?.payload?.headers);
  const participants: MailParticipant[] = [
    ...parseAddresses(headers.get("from")).map(person => ({ ...person, role: "from" as const })),
    ...parseAddresses(headers.get("to")).map(person => ({ ...person, role: "to" as const })),
    ...parseAddresses(headers.get("cc")).map(person => ({ ...person, role: "cc" as const })),
  ].slice(0, 30);
  const sent = Number(raw?.internalDate);
  const headerDate = Date.parse(headers.get("date") || "");
  const sentAt = Number.isFinite(sent) && sent > 0 ? new Date(sent).toISOString() : Number.isFinite(headerDate) ? new Date(headerDate).toISOString() : "";
  if (!sentAt) return null;
  return {
    provider: "gmail",
    externalId,
    threadId: String(raw?.threadId || "").slice(0, 256),
    direction: directionFor(participants, ownerEmail),
    subject: String(headers.get("subject") || "(No subject)").replace(/\s+/g, " ").trim().slice(0, 300) || "(No subject)",
    snippet: clipSnippet(raw?.snippet),
    participants,
    sentAt,
  };
}

export function normalizeOutlookMessage(raw: any, ownerEmail: string): Omit<EmailActivity, "id" | "connectionId" | "ownerUserId" | "dealIds" | "accountIds" | "accountNames"> | null {
  if (raw?.isDraft) return null;
  const externalId = String(raw?.id || "");
  if (!externalId || externalId.length > 512) return null;
  const people = (role: MailParticipant["role"], list: any[]) => (Array.isArray(list) ? list : []).slice(0, 30).flatMap(item => {
    const email = String(item?.emailAddress?.address || "").trim().toLowerCase();
    if (!email.includes("@")) return [];
    return [{ name: String(item?.emailAddress?.name || "").trim().slice(0, 200), email, role }];
  });
  const from = raw?.from?.emailAddress?.address ? [{ name: String(raw.from.emailAddress.name || "").slice(0, 200), email: String(raw.from.emailAddress.address).toLowerCase(), role: "from" as const }] : [];
  const participants = [...from, ...people("to", raw?.toRecipients), ...people("cc", raw?.ccRecipients)].slice(0, 30);
  const sentAtMs = Date.parse(raw?.receivedDateTime || raw?.sentDateTime || "");
  if (!Number.isFinite(sentAtMs)) return null;
  return {
    provider: "outlook",
    externalId,
    threadId: String(raw?.conversationId || "").slice(0, 256),
    direction: directionFor(participants, ownerEmail),
    subject: String(raw?.subject || "(No subject)").replace(/\s+/g, " ").trim().slice(0, 300) || "(No subject)",
    snippet: clipSnippet(raw?.bodyPreview),
    participants,
    sentAt: new Date(sentAtMs).toISOString(),
  };
}

async function mailRecords(): Promise<MailRecord[]> {
  const rows = await db.select({
    id: crmRecords.id, kind: crmRecords.kind, email: crmRecords.email, domain: crmRecords.domain, associations: crmRecords.associations,
  }).from(crmRecords).where(eq(crmRecords.orgId, currentTenantId())).all();
  return rows.map((row: { id: string; kind: string; email: string | null; domain: string | null; associations: string }) => ({
    ...row, associations: parseJson<string[]>(row.associations, []),
  }));
}

function activityFromRow(row: any, names: Map<string, string>): EmailActivity {
  const accountIds = parseJson<string[]>(row.accountIds, []);
  return {
    id: row.id,
    connectionId: row.connectionId,
    provider: row.provider === "outlook" ? "outlook" : "gmail",
    externalId: row.externalId,
    threadId: row.threadId,
    ownerUserId: row.ownerUserId,
    direction: row.direction === "outbound" ? "outbound" : "inbound",
    subject: row.subject,
    snippet: clipSnippet(row.snippet),
    participants: parseJson<MailParticipant[]>(row.participants, []),
    sentAt: row.sentAt,
    dealIds: parseJson<string[]>(row.dealIds, []),
    accountIds,
    accountNames: accountIds.map(id => names.get(id)).filter((name): name is string => Boolean(name)),
  };
}

export async function visibleDealEmails(auth: Pick<AuthUser, "isAdmin" | "userId">, dealId: string): Promise<EmailActivity[]> {
  if (!(await emailCaptureEnabled())) return [];
  const orgId = currentTenantId();
  const deal = await db.select().from(crmRecords).where(and(eq(crmRecords.orgId, orgId), eq(crmRecords.id, dealId), eq(crmRecords.kind, "deal"))).get();
  if (!deal) return [];
  const associationIds = new Set(parseJson<string[]>(deal.associations, []));
  const rows = await db.select().from(emailMessages).where(eq(emailMessages.orgId, orgId)).orderBy(desc(emailMessages.sentAt)).limit(400).all();
  const matched = rows.filter((row: { dealIds: string; accountIds: string }) => {
    const deals = parseJson<string[]>(row.dealIds, []);
    const accounts = parseJson<string[]>(row.accountIds, []);
    return deals.includes(dealId) || accounts.some(id => associationIds.has(id));
  }).slice(0, 80);
  const accountIds = [...new Set(matched.flatMap((row: { accountIds: string }) => parseJson<string[]>(row.accountIds, [])))];
  const names = new Map<string, string>();
  if (accountIds.length) {
    const companies = await db.select({ id: crmRecords.id, name: crmRecords.name, kind: crmRecords.kind }).from(crmRecords).where(eq(crmRecords.orgId, orgId)).all();
    for (const company of companies) if (company.kind === "company" && accountIds.includes(company.id)) names.set(company.id, company.name);
  }
  return filterEmailsForViewer(auth, matched.map((row: any) => activityFromRow(row, names)));
}

export async function storeEmailMessage(connection: { id: string; provider: string; config: ConnectionConfig }, message: Omit<EmailActivity, "id" | "connectionId" | "ownerUserId" | "dealIds" | "accountIds" | "accountNames">, match: MailMatch) {
  const orgId = currentTenantId();
  const id = stableId("email", orgId, connection.id, message.externalId);
  const values = {
    id, orgId, connectionId: connection.id, provider: connection.provider, externalId: message.externalId,
    threadId: message.threadId, ownerUserId: connection.config.ownerUserId || "", direction: message.direction,
    subject: message.subject, snippet: clipSnippet(message.snippet), participants: JSON.stringify(message.participants),
    sentAt: message.sentAt, dealIds: JSON.stringify(match.dealIds), accountIds: JSON.stringify(match.accountIds),
    syncedAt: new Date().toISOString(),
  };
  await db.insert(emailMessages).values(values).onConflictDoUpdate({ target: emailMessages.id, set: values }).run();
  return id;
}

export async function verifyMailbox(provider: MailboxProvider, token: string): Promise<Partial<ConnectionConfig>> {
  if (provider === "gmail") {
    const profile = await providerRequest<any>("Gmail", GMAIL_ORIGIN, "/gmail/v1/users/me/profile", { Authorization: `Bearer ${token}` });
    const accountEmail = String(profile?.emailAddress || "").trim().toLowerCase();
    if (!accountEmail.includes("@")) throw new RevenueError("Gmail did not return the mailbox address.", 502);
    return { accountEmail };
  }
  const user = await providerRequest<any>("Outlook", GRAPH_ORIGIN, "/v1.0/me?$select=mail,userPrincipalName", { Authorization: `Bearer ${token}` });
  await providerRequest("Outlook", GRAPH_ORIGIN, "/v1.0/me/messages?$top=1&$select=id", { Authorization: `Bearer ${token}` });
  const accountEmail = String(user?.mail || user?.userPrincipalName || "").trim().toLowerCase();
  if (!accountEmail.includes("@")) throw new RevenueError("Microsoft did not return the mailbox address.", 502);
  return { accountEmail };
}

function gmailPageToken(value: string) {
  if (!/^[A-Za-z0-9_\-=]{1,2048}$/.test(value)) throw new RevenueError("Gmail returned an invalid results page.", 502);
  return value;
}

function outlookPagePath(value: string) {
  const url = new URL(value, GRAPH_ORIGIN);
  if (url.origin !== GRAPH_ORIGIN || url.username || url.password || url.hash || url.pathname !== "/v1.0/me/messages") throw new RevenueError("Microsoft returned an invalid mail page.", 502);
  return url.pathname + url.search;
}

export async function mailboxProviderPage(provider: MailboxProvider, token: string, config: ConnectionConfig, state: SyncCursor) {
  const base = Date.parse(state.syncStartedAt || new Date().toISOString());
  const windowStart = state.windowStart || new Date(base - (state.full ? 180 : 30) * 86400000).toISOString();
  const nextState = { ...state, windowStart };
  const settings = await emailCaptureSettings();
  const index = buildMailIndex(await mailRecords(), settings.excludedDomains);
  const ownerEmail = config.accountEmail || "";
  if (provider === "gmail") {
    const query = new URLSearchParams({ maxResults: "20", q: `after:${Math.floor(Date.parse(windowStart) / 1000)} -in:spam -in:trash -in:drafts` });
    if (state.after) query.set("pageToken", gmailPageToken(state.after));
    const list = await providerRequest<any>("Gmail", GMAIL_ORIGIN, `/gmail/v1/users/me/messages?${query}`, { Authorization: `Bearer ${token}` });
    const ids = Array.isArray(list.messages) ? list.messages : [];
    const messages: { message: Omit<EmailActivity, "id" | "connectionId" | "ownerUserId" | "dealIds" | "accountIds" | "accountNames">; match: MailMatch }[] = [];
    for (const item of ids) {
      const id = String(item?.id || "");
      if (!/^[A-Za-z0-9]+$/.test(id)) continue;
      const raw = await providerRequest<any>("Gmail", GMAIL_ORIGIN, `/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject&metadataHeaders=Date`, { Authorization: `Bearer ${token}` });
      const message = normalizeGmailMessage(raw, ownerEmail);
      if (!message) continue;
      const match = index.match(message.participants);
      if (match) messages.push({ message, match });
    }
    const after = list.nextPageToken ? gmailPageToken(String(list.nextPageToken)) : undefined;
    return { messages, next: { ...nextState, after, complete: !after } };
  }
  const select = "id,conversationId,subject,bodyPreview,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,isDraft";
  const path = state.after
    ? outlookPagePath(state.after)
    : `/v1.0/me/messages?${new URLSearchParams({ "$top": "20", "$select": select, "$orderby": "receivedDateTime desc", "$filter": `receivedDateTime ge ${windowStart} and isDraft eq false` })}`;
  const result = await providerRequest<any>("Outlook", GRAPH_ORIGIN, path, { Authorization: `Bearer ${token}` });
  if (!Array.isArray(result.value)) throw new RevenueError("Microsoft returned an invalid message list. Retry sync.", 502);
  const messages = result.value.flatMap((raw: any) => {
    const message = normalizeOutlookMessage(raw, ownerEmail);
    if (!message) return [];
    const match = index.match(message.participants);
    return match ? [{ message, match }] : [];
  });
  const after = result["@odata.nextLink"] ? outlookPagePath(result["@odata.nextLink"]) : undefined;
  return { messages, next: { ...nextState, after, complete: !after } };
}

export async function reconcileEmailWindow(connectionId: string, state: SyncCursor) {
  if (!state.complete || !state.syncStartedAt || !state.windowStart) return;
  await db.delete(emailMessages).where(and(
    eq(emailMessages.orgId, currentTenantId()),
    eq(emailMessages.connectionId, connectionId),
    sql`${emailMessages.sentAt} >= ${state.windowStart}`,
    lt(emailMessages.syncedAt, state.syncStartedAt),
  )).run();
}

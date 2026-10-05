// Collection rules for browser product analytics. This module has no project token.

/** Official US cloud ingest host. Confirmed in the PostHog Next.js and JavaScript docs. */
export const ANALYTICS_INGEST_HOST = "https://us.i.posthog.com";

/** Asset host the browser SDK uses for lazy bundles and remote config. */
export const ANALYTICS_ASSET_HOST = "https://us-assets.i.posthog.com";

/** US app host. Ingest stays on ANALYTICS_INGEST_HOST. */
export const ANALYTICS_APP_HOST = "https://us.posthog.com";

export const analyticsScriptHosts = [ANALYTICS_INGEST_HOST, ANALYTICS_ASSET_HOST] as const;

export const analyticsConnectHosts = [ANALYTICS_INGEST_HOST, ANALYTICS_ASSET_HOST] as const;

export const PAGE_VIEW_EVENT = "$pageview";
export const FORM_SUBMITTED_EVENT = "form_submitted";
export const SIGNED_IN_EVENT = "signed_in";

export const PERSON_EMAIL_SOURCE = "email_source";
export const PERSON_CONSENT_STATUS = "consent_status";
export const PERSON_CONSENT_TIME = "consent_time";

/** The site has no consent control, so this is recorded instead of guessing. */
export const CONSENT_NOT_COLLECTED = "not_collected";

const ACCOUNT_ID = /^user_[A-Za-z0-9]{8,64}$/;
const CONTACT_ID = /^contact_[a-f0-9]{32}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MUTATION = new Set(["POST", "PUT", "PATCH", "DELETE"]);
// `token` is the public project token PostHog requires on every event. Stripping it drops the event.
const SENSITIVE_KEY = /^(email|e-mail|password|passwd|secret|authorization|cookie|phone|ssn|access_token|api_token|auth_token|id_token|refresh_token)$/i;

export type ConsentStatus = typeof CONSENT_NOT_COLLECTED;

export type PersonFields = {
  email_source: string;
  consent_status: ConsentStatus;
  consent_time: null;
};

export type IdentityPlan = {
  action: "identify" | "reset" | "none";
  captureSignedIn: boolean;
  storedAccountId: string | null;
};

/** Person fields are separate. Consent is not inferred from a page view. */
export function personFields(emailSource: string): PersonFields {
  return {
    email_source: emailSource.slice(0, 80),
    consent_status: CONSENT_NOT_COLLECTED,
    consent_time: null,
  };
}

/** Clerk account id. Shared placeholders and anonymous UUIDs are rejected. */
export function stableAccountId(id: string | null | undefined): string | null {
  const value = (id ?? "").trim();
  return ACCOUNT_ID.test(value) ? value : null;
}

export function isContactKey(id: string | null | undefined): boolean {
  return CONTACT_ID.test((id ?? "").trim());
}

/**
 * Stable contact key for a submitted email. The email itself is not the id.
 * Only call this after a successful form submit, never from a page view.
 */
export async function stableContactIdFromEmail(email: string): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  if (!EMAIL.test(normalized) || normalized.length > 254) return null;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`refreshqueue-contact:${normalized}`)
  );
  const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `contact_${hex.slice(0, 32)}`;
}

/** Prefer the signed-in account id so a later sign-in keeps the same person. */
export function contactIdForActivity(input: {
  accountId?: string | null;
  emailContactId?: string | null;
}): string | null {
  return stableAccountId(input.accountId) ?? (isContactKey(input.emailContactId) ? input.emailContactId!.trim() : null);
}

/**
 * Identify only when an account is present. Reset only when a previous account
 * identity is still on the browser after sign-out. Anonymous ids and form contact
 * keys stay put so earlier activity is not rotated away.
 */
export function identityPlan(input: {
  accountId: string | null;
  distinctId: string;
  isIdentified: boolean;
  storedAccountId: string | null;
}): IdentityPlan {
  const accountId = stableAccountId(input.accountId);
  const storedAccountId = stableAccountId(input.storedAccountId);
  if (accountId) {
    return {
      action: "identify",
      captureSignedIn: storedAccountId !== accountId,
      storedAccountId: accountId,
    };
  }
  const identifiedAccount = input.isIdentified ? stableAccountId(input.distinctId) : null;
  if (identifiedAccount || storedAccountId) {
    return { action: "reset", captureSignedIn: false, storedAccountId: null };
  }
  return { action: "none", captureSignedIn: false, storedAccountId: null };
}

export function formLabel(input: { analyticsForm?: string; id?: string; name?: string }): string {
  const label = (input.analyticsForm || input.id || input.name || "form").trim() || "form";
  return label.slice(0, 80);
}

export function pagePathname(pathname: string): string {
  const path = pathname.split(/[?#]/, 1)[0] || "/";
  if (!path.startsWith("/") || path.startsWith("//")) return "/";
  return path.slice(0, 200);
}

export function isSameOriginMutation(url: string, method: string, pageOrigin: string): boolean {
  if (!MUTATION.has(method.toUpperCase())) return false;
  try {
    const parsed = new URL(url, pageOrigin);
    if (parsed.origin !== pageOrigin) return false;
    if (parsed.pathname.includes("/__auth") || parsed.pathname.includes("/__clerk")) return false;
    return true;
  } catch {
    return false;
  }
}

export function submissionSucceeded(status: number, body: unknown): boolean {
  if (status < 200 || status >= 300) return false;
  if (!body || typeof body !== "object" || Array.isArray(body)) return true;
  return (body as { ok?: unknown }).ok !== false;
}

export async function planFormSuccess(input: {
  formId: string;
  pagePath: string;
  emailSource: string | null;
  email: string | null;
  accountId: string | null;
}): Promise<{ contactId: string | null; person: PersonFields | null; properties: Record<string, unknown> }> {
  const properties: Record<string, unknown> = {
    form_id: formLabel({ analyticsForm: input.formId }),
    page_path: pagePathname(input.pagePath),
  };
  const emailSource = input.emailSource?.trim() || "";
  if (!emailSource) return { contactId: null, person: null, properties };
  const person = personFields(emailSource);
  Object.assign(properties, person);
  const emailContactId = input.email ? await stableContactIdFromEmail(input.email) : null;
  return {
    contactId: contactIdForActivity({ accountId: input.accountId, emailContactId }),
    person,
    properties,
  };
}

type AnalyticsRecord = Record<string, unknown>;

function redactRecord(record: AnalyticsRecord | undefined): AnalyticsRecord | undefined {
  if (!record) return record;
  const next: AnalyticsRecord = {};
  for (const [key, value] of Object.entries(record)) {
    if (SENSITIVE_KEY.test(key)) continue;
    if (/^\$el.*value|^attr__value$|placeholder/i.test(key)) continue;
    if (key === "$elements" && Array.isArray(value)) {
      next[key] = value.map((element) => {
        if (!element || typeof element !== "object") return element;
        const copy = { ...(element as AnalyticsRecord) };
        delete copy.attr__value;
        delete copy["attr__placeholder"];
        delete copy.value;
        return copy;
      });
      continue;
    }
    next[key] = value;
  }
  return next;
}

/** Drop field values and direct identifiers. Keep email_source as its own field. */
export function redactAnalyticsEvent<T extends { properties?: AnalyticsRecord; $set?: AnalyticsRecord; $set_once?: AnalyticsRecord }>(
  event: T | null
): T | null {
  if (!event) return event;
  if (event.properties) event.properties = redactRecord(event.properties);
  if (event.$set) event.$set = redactRecord(event.$set);
  if (event.$set_once) event.$set_once = redactRecord(event.$set_once);
  return event;
}

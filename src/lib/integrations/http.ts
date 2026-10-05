import { RevenueError } from "../revenue/security";

const SECRET_FIELD = /^(access_token|refresh_token|id_token|client_secret|authorization|password|refreshToken|token)$/i;

function redactString(value: string): string {
  return value
    .replace(/ya29\.[0-9A-Za-z._~+/-]+/g, "[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [redacted]")
    .replace(/whsec_[A-Za-z0-9+/=_-]+/g, "whsec_[redacted]")
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, "[redacted]")
    .replace(/((?:access|refresh|id)_token|client_secret)(["'\s:=]+)[A-Za-z0-9._~+/-]+/gi, "$1$2[redacted]");
}

function stripHeaderSecrets(body: string, headers: Record<string, string>): string {
  let text = body;
  for (const [name, value] of Object.entries(headers)) {
    if (!/authorization|api-key|token|secret/i.test(name) || typeof value !== "string") continue;
    for (const secret of [value, value.replace(/^(Bearer|Basic)\s+/i, "")]) {
      if (secret.length >= 8) text = text.split(secret).join("[redacted]");
    }
  }
  return text;
}

function redactValue(value: unknown, key = ""): unknown {
  if (typeof value === "string") {
    if (SECRET_FIELD.test(key) || (key.toLowerCase() === "code" && value.length > 24)) return "[redacted]";
    return redactString(value);
  }
  if (Array.isArray(value)) return value.slice(0, 20).map(item => redactValue(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).slice(0, 40).map(([field, item]) => [field, redactValue(item, field)]));
  }
  return value;
}

/** Provider bodies are logged for diagnosis. Tokens, authorization codes, and secrets are removed first. */
export function redactProviderBody(body: string): string {
  const raw = body.slice(0, 8000);
  try {
    return redactString(JSON.stringify(redactValue(JSON.parse(raw)))).slice(0, 2000);
  } catch {
    return redactString(raw).replace(/\s+/g, " ").trim().slice(0, 2000);
  }
}

/** A short reason safe to show an admin. The raw body stays in the worker log. */
export function providerFailureDetail(body: string): string {
  let message = "";
  let reason = "";
  let providerMessage = "";
  try {
    const parsed = JSON.parse(body.slice(0, 8000));
    const error = parsed?.error;
    if (typeof parsed?.message === "string") providerMessage = parsed.message;
    if (typeof error === "string") message = String(parsed.error_description || error);
    else     if (error && typeof error === "object") {
      message = String(error.message || "");
      const first = Array.isArray(error.errors) ? error.errors[0] : undefined;
      reason = String(first?.reason || error.code || error.status || "");
    }
  } catch {
    message = body.slice(0, 180);
  }
  const text = `${reason} ${message} ${providerMessage}`.toLowerCase();
  if (/accessnotconfigured|has not been used|api has not been used|is disabled|service_disabled/.test(text)) {
    if (/\bmeet\b/.test(text)) return "The Google Meet API is not enabled for this Google Cloud project.";
    if (/\bdrive\b/.test(text)) return "The Google Drive API is not enabled for this Google Cloud project.";
    if (/\bpeople\b/.test(text)) return "The People API is not enabled for this Google Cloud project.";
    if (/\bgmail\b/.test(text)) return "The Gmail API is not enabled for this Google Cloud project.";
    return "A required Google API is not enabled for this Google Cloud project.";
  }
  if (reason === "insufficientPermissions" || /insufficient authentication scopes|insufficient permission/.test(text)) {
    if (/\bmeet\b|\bdrive\b|\bpeople\b|contacts/.test(text)) return "The granted token is missing Google Meet, Drive, or contacts read permission.";
    return "The granted token is missing the Gmail metadata permission.";
  }
  if (/domainpolicy|domain administrators have disabled/.test(text)) return "The Google Workspace domain blocks Gmail access for this app.";
  if (/does not support 'q'|metadata scope/.test(text)) return "Gmail rejected a search query that the metadata scope does not allow.";
  if (/authorization_requestdenied|need admin approval|admin consent|aadsts65001|insufficient privileges/.test(text)) {
    return safeProviderMessage(message) || "A Microsoft 365 administrator must grant consent for Teams transcript and recording access.";
  }
  if (/personal microsoft account|not supported for personal|work or school account/.test(text)) {
    return "Teams transcripts need a work or school account. Personal Microsoft accounts cannot read meeting transcripts.";
  }
  if (/aadsts|onlinemeeting|microsoft graph|graph\.microsoft|teams transcript|teams recording/.test(text)) return safeProviderMessage(message);
  const cleaned = providerMessage.replace(/\s+/g, " ").trim().slice(0, 180);
  if (cleaned && !/\[redacted\]|whsec_|bearer\s|api[_-]?key|token|secret|authorization|\beyj/i.test(cleaned)) return cleaned;
  return "";
}

function safeProviderMessage(message: string): string {
  const cleaned = message.replace(/\s+/g, " ").trim();
  if (!cleaned || /bearer\s|ya29\.|\beyj/i.test(cleaned)) return "";
  return cleaned.slice(0, 220);
}

export class ProviderError extends RevenueError {
  constructor(public provider: string, public providerStatus: number, public retryAfterSeconds = 0, detail = "") {
    const base = providerStatus === 401 || providerStatus === 403
      ? `${provider}: check the credential and required permissions.`
      : providerStatus === 429 ? `${provider}: rate limit reached. The job will retry.`
      : `${provider}: request failed (${providerStatus}).`;
    const safe = detail.replace(/\s+/g, " ").trim().slice(0, 300);
    super(safe ? `${base} ${safe}` : base, providerStatus === 401 || providerStatus === 403 ? 400 : providerStatus === 429 ? 429 : 502);
  }
}

/** A malformed success response must never be treated as an empty completed snapshot. */
export function providerList(value: unknown, provider: string, optional = false): any[] {
  if (optional && value === undefined) return [];
  if (!Array.isArray(value) || value.length > 10000) throw new RevenueError(`${provider}: invalid or oversized list response. Retry sync.`, 502);
  return value;
}

/** Fixed vendor origins; redirects cannot forward credentials to another host. */
export async function providerRequest<T>(provider: string, origin: string, pathname: string, headers: Record<string, string>, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${origin}${pathname}`, {
    ...init, headers: { Accept: "application/json", ...headers, ...init.headers },
    // Workers supports manual/follow only. A non-OK redirect is rejected below.
    redirect: "manual", signal: AbortSignal.timeout(25000), cache: "no-store",
  });
  if (!response.ok) {
    const retry = response.headers.get("retry-after");
    const seconds = retry ? Number(retry) || Math.max(0, (Date.parse(retry) - Date.now()) / 1000) : 0;
    const body = stripHeaderSecrets(await response.text().catch(() => ""), headers);
    // The admin banner stays short. Workers logs get the provider status and body with tokens removed.
    console.error(`${provider} request failed`, response.status, redactProviderBody(body));
    throw new ProviderError(provider, response.status, Math.min(3600, Math.ceil(seconds)), providerFailureDetail(body));
  }
  if (response.status === 204) return {} as T;
  return response.json() as Promise<T>;
}

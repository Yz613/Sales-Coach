/**
 * OpenAI-compatible base URLs for a self-hosted model server.
 * Private and link-local hosts are refused unless the operator sets
 * ALLOW_PRIVATE_MODEL_URLS=true. Redirects are not followed by the callers.
 */

export class LocalModelUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LocalModelUrlError";
  }
}

export function privateModelUrlsAllowed(env: Record<string, string | undefined> = process.env): boolean {
  return env.ALLOW_PRIVATE_MODEL_URLS === "true";
}

export function isPrivateOrLocalHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase().replace(/\.$/, "");
  if (!host) return true;
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
  if (host === "metadata.google.internal" || host === "metadata.google.com") return true;
  if (host === "0.0.0.0" || host === "::" || host === "::1") return true;

  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const parts = v4.slice(1).map((part) => Number(part));
    if (parts.some((part) => part > 255)) return true;
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }

  if (host.includes(":")) {
    const head = host.split(":")[0] || "";
    if (head === "fc" || head === "fd" || head.startsWith("fc") || head.startsWith("fd")) return true;
    if (/^fe[89ab]/.test(head)) return true;
  }
  return false;
}

export function normalizeOpenAiBaseUrl(raw: string, options: { allowPrivate: boolean }): string {
  const trimmed = raw.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new LocalModelUrlError("The model base URL must be an http or https URL, including the host.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new LocalModelUrlError("The model base URL must start with http:// or https://.");
  }
  if (url.username || url.password) {
    throw new LocalModelUrlError("Put the API key in the key field. The base URL cannot include a username or password.");
  }
  if (!options.allowPrivate && isPrivateOrLocalHost(url.hostname)) {
    throw new LocalModelUrlError(
      "That host is local or private. Set ALLOW_PRIVATE_MODEL_URLS=true on a self-hosted install before using it."
    );
  }
  url.hash = "";
  url.search = "";
  let path = url.pathname.replace(/\/+$/, "");
  if (path.endsWith("/chat/completions") || path.endsWith("/audio/transcriptions")) {
    path = path.replace(/\/(chat\/completions|audio\/transcriptions)$/, "");
  }
  url.pathname = path || "/";
  return url.toString().replace(/\/$/, "");
}

export function openAiChatCompletionsUrl(baseUrl: string, options: { allowPrivate: boolean }): string {
  const base = normalizeOpenAiBaseUrl(baseUrl, options);
  return `${base}/chat/completions`;
}

export function openAiTranscriptionsUrl(baseUrl: string, options: { allowPrivate: boolean }): string {
  const base = normalizeOpenAiBaseUrl(baseUrl, options);
  return `${base}/audio/transcriptions`;
}

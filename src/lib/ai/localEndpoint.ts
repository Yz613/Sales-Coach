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

function isPrivateIpv4(parts: number[]): boolean {
  if (parts.length !== 4 || parts.some((part) => part > 255)) return true;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

/** Expand an IPv6 address to eight 16-bit groups, including IPv4-mapped tails. */
function expandIpv6(host: string): number[] | null {
  let body = host;
  let v4tail: number[] | null = null;
  const dotted = body.match(/^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (dotted) {
    const octets = dotted[2].split(".").map((part) => Number(part));
    if (octets.some((part) => part > 255)) return null;
    v4tail = [(octets[0] << 8) | octets[1], (octets[2] << 8) | octets[3]];
    body = dotted[1].replace(/:$/, "");
  }
  const halves = body.split("::");
  if (halves.length > 2) return null;
  const parseSide = (part: string): number[] | null => {
    if (!part) return [];
    const groups = part.split(":");
    const nums: number[] = [];
    for (const group of groups) {
      if (!/^[0-9a-f]{1,4}$/i.test(group)) return null;
      nums.push(Number.parseInt(group, 16));
    }
    return nums;
  };
  const left = parseSide(halves[0]);
  const right = halves.length === 2 ? parseSide(halves[1]) : [];
  if (!left || !right) return null;
  const tail = v4tail || [];
  if (halves.length === 1) {
    return left.length + tail.length === 8 ? [...left, ...tail] : null;
  }
  const missing = 8 - (left.length + right.length + tail.length);
  if (missing < 0) return null;
  return [...left, ...Array(missing).fill(0), ...right, ...tail];
}

function isPrivateIpv6(host: string): boolean {
  if (host.includes("%")) return true;
  const groups = expandIpv6(host);
  if (!groups || groups.length !== 8) return true;
  const [g0, g1, g2, g3, g4, g5, g6, g7] = groups;
  if ((g0 & 0xfe00) === 0xfc00) return true;
  if ((g0 & 0xffc0) === 0xfe80) return true;
  const embedded = (g6 << 16) | g7;
  const octets = [(embedded >>> 24) & 255, (embedded >>> 16) & 255, (embedded >>> 8) & 255, embedded & 255];
  const prefixClear = g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0;
  // ::ffff:0:0/96 (IPv4-mapped) and ::/96 (IPv4-compatible, including ::7f00:1).
  if (prefixClear && (g5 === 0xffff || g5 === 0)) return isPrivateIpv4(octets);
  return false;
}

export function isPrivateOrLocalHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase().replace(/\.$/, "");
  if (!host) return true;
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
  if (host === "metadata.google.internal" || host === "metadata.google.com") return true;
  if (host === "0.0.0.0" || host === "::" || host === "::1") return true;

  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) return isPrivateIpv4(v4.slice(1).map((part) => Number(part)));
  if (host.includes(":")) return isPrivateIpv6(host);
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

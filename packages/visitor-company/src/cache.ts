import { coarsePrefix } from "./ip.js";
import type { CacheEntry, KvNamespaceLike, VisitorCache } from "./types.js";

/** Thirty days. Long enough that a stable company ASN is not re-looked-up on every visit. */
export const DEFAULT_CACHE_TTL_SECONDS = 30 * 24 * 60 * 60;

const CONFIDENCE = new Set(["high", "medium", "low"]);
const REASONS = new Set([
  "eu_privacy",
  "privacy_signal",
  "bot",
  "residential_isp",
  "mobile_carrier",
  "vpn",
  "hosting_provider",
  "transit_provider",
  "content_network",
  "no_signal",
  "unresolved",
]);
const NETWORK_TYPES = new Set([
  "enterprise",
  "educational",
  "government",
  "nonprofit",
  "isp",
  "mobile",
  "vpn",
  "hosting",
  "transit",
  "content",
  "unknown",
]);

/**
 * Cache key for a decision. Prefers the ASN. Falls back to a /24 or /48 prefix
 * and never uses the host address itself.
 */
export function visitorCacheKey(input: { asn?: number | null; ip?: string | null }): string | null {
  if (typeof input.asn === "number" && Number.isInteger(input.asn) && input.asn > 0) {
    return `asn:${input.asn}`;
  }
  if (input.ip) {
    const prefix = coarsePrefix(input.ip);
    if (prefix) return `pfx:${prefix}`;
  }
  return null;
}

export function isCacheEntry(value: unknown): value is CacheEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<CacheEntry>;
  if (typeof entry.networkType !== "string" || !NETWORK_TYPES.has(entry.networkType)) return false;
  if (entry.status === "identified") {
    return typeof entry.confidence === "string" && CONFIDENCE.has(entry.confidence) && typeof entry.source === "string";
  }
  if (entry.status === "skipped") {
    return typeof entry.reason === "string" && REASONS.has(entry.reason);
  }
  return false;
}

export function createMemoryCache(options?: { now?: () => number }): VisitorCache {
  const now = options?.now ?? Date.now;
  const store = new Map<string, { expiresAt: number; entry: CacheEntry }>();
  return {
    async get(key) {
      const row = store.get(key);
      if (!row) return null;
      if (row.expiresAt <= now()) {
        store.delete(key);
        return null;
      }
      return { ...row.entry };
    },
    async set(key, entry, ttlSeconds) {
      const ttl = Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? ttlSeconds : DEFAULT_CACHE_TTL_SECONDS;
      store.set(key, { entry: { ...entry }, expiresAt: now() + ttl * 1000 });
    },
  };
}

/**
 * Workers KV adapter. Keys are prefixed and values are the company decision
 * only. `expirationTtl` is at least 60 seconds because KV rejects shorter TTLs.
 */
export function createKvCache(kv: KvNamespaceLike, options?: { keyPrefix?: string }): VisitorCache {
  const keyPrefix = options?.keyPrefix ?? "vc:";
  return {
    async get(key) {
      const stored = await kv.get(keyPrefix + key, "json");
      if (!isCacheEntry(stored)) return null;
      return { ...stored };
    },
    async set(key, entry, ttlSeconds) {
      const ttl = Math.max(60, Math.floor(ttlSeconds));
      await kv.put(keyPrefix + key, JSON.stringify(entry), { expirationTtl: ttl });
    },
  };
}

import type { CacheEntry, KvNamespaceLike, VisitorCache } from "./types.js";
/** Thirty days. Long enough that a stable company ASN is not re-looked-up on every visit. */
export declare const DEFAULT_CACHE_TTL_SECONDS: number;
/**
 * Cache key for a decision. Prefers the ASN. Falls back to a /24 or /48 prefix
 * and never uses the host address itself.
 */
export declare function visitorCacheKey(input: {
    asn?: number | null;
    ip?: string | null;
}): string | null;
export declare function isCacheEntry(value: unknown): value is CacheEntry;
export declare function createMemoryCache(options?: {
    now?: () => number;
}): VisitorCache;
/**
 * Workers KV adapter. Keys are prefixed and values are the company decision
 * only. `expirationTtl` is at least 60 seconds because KV rejects shorter TTLs.
 */
export declare function createKvCache(kv: KvNamespaceLike, options?: {
    keyPrefix?: string;
}): VisitorCache;
//# sourceMappingURL=cache.d.ts.map
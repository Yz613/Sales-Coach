import type { CacheEntry, Confidence, NetworkType, SkipReason, VisitorCompanyResult } from "./types.js";
export declare function skipped(fields: {
    reason: SkipReason;
    asn?: number | null;
    country?: string | null;
    networkType?: NetworkType;
    source?: string | null;
}): VisitorCompanyResult;
export declare function identified(fields: {
    companyName: string | null;
    companyDomain: string | null;
    asn: number | null;
    networkType: NetworkType;
    country: string | null;
    confidence: Confidence;
    source: string;
}): VisitorCompanyResult;
export declare function toCacheEntry(result: VisitorCompanyResult): CacheEntry;
/** Country always comes from the current request, never from a cached visitor. */
export declare function fromCacheEntry(entry: CacheEntry, country: string | null): VisitorCompanyResult;
//# sourceMappingURL=result.d.ts.map
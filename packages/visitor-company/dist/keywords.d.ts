import type { NetworkType, SkipReason } from "./types.js";
export interface KeywordMatch {
    networkType: NetworkType;
    reason: SkipReason | null;
}
export declare function matchDenyKeyword(name: string): KeywordMatch | null;
export declare function matchAllowKeyword(name: string): KeywordMatch | null;
export declare function matchDenyDomain(domain: string): KeywordMatch | null;
//# sourceMappingURL=keywords.d.ts.map
import type { Classification, NetworkType, SkipReason } from "./types.js";
/** ASN classifications generated from PeeringDB. Built once, on first use. */
export declare function loadPeeringDbNetworks(): ReadonlyMap<number, NetworkType>;
export declare function skipReasonFor(networkType: NetworkType): SkipReason | null;
export declare function isOrganizationType(networkType: NetworkType): boolean;
/**
 * Decide whether an ASN / organization name belongs to one organization or to
 * a shared access network. Caller overrides win, then deny keywords, then the
 * curated ASN list, then the PeeringDB snapshot, then allow keywords.
 */
export declare function classifyNetwork(input: {
    asn?: number | string | null;
    asOrganization?: string | null;
    networks?: ReadonlyMap<number, NetworkType> | Readonly<Record<number, NetworkType>>;
}): Classification;
//# sourceMappingURL=classify.d.ts.map
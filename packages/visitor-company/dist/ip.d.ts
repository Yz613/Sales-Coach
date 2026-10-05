/** Parse `15169` or `AS15169`. Returns null for anything else. */
export declare function parseAsn(value: unknown): number | null;
export declare function normalizeCountry(value: unknown): string | null;
export declare function cleanName(value: unknown): string | null;
/** Hostnames only. Rejects bare IPs and strings that are not domains. */
export declare function cleanDomain(value: unknown): string | null;
export declare function isPublicIp(value: string): boolean;
/**
 * Cache key coarser than a single host: IPv4 /24 or IPv6 /48.
 * Returns null for private or unparseable addresses.
 */
export declare function coarsePrefix(ip: string): string | null;
//# sourceMappingURL=ip.d.ts.map
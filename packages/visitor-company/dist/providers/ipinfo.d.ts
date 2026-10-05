import type { CompanyProvider } from "../types.js";
export interface IpinfoProviderOptions {
    token: string;
    fetch?: typeof fetch;
    timeoutMs?: number;
    /** Override the API origin in tests. */
    baseUrl?: string;
}
/**
 * IPinfo Lite returns the ASN, its name, and `as_domain`.
 * The dataset is CC-BY-SA 4.0. Sites that enable this provider must attribute IPinfo.
 */
export declare function createIpinfoProvider(options: IpinfoProviderOptions): CompanyProvider;
//# sourceMappingURL=ipinfo.d.ts.map
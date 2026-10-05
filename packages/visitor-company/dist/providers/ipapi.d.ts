import type { CompanyProvider } from "../types.js";
export interface IpapiProviderOptions {
    apiKey: string;
    fetch?: typeof fetch;
    timeoutMs?: number;
    baseUrl?: string;
}
/**
 * Fallback provider. The free key allows about 1,000 requests per day and adds
 * company type plus VPN, proxy, Tor, mobile, and datacenter flags.
 */
export declare function createIpapiProvider(options: IpapiProviderOptions): CompanyProvider;
//# sourceMappingURL=ipapi.d.ts.map
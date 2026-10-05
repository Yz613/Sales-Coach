import type { VisitorCompanyResult } from "./types.js";
/** The bits of posthog-js this helper calls. Pass `posthog` itself; the package does not import it. */
export interface PostHogLike {
    register(properties: Record<string, unknown>): void;
    setPersonProperties?(properties: Record<string, unknown>): void;
    group?(type: string, key: string, properties?: Record<string, unknown>): void;
}
/** Enough of `sessionStorage` to remember one result for the tab. */
export interface SessionStore {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}
export interface RememberVisitorCompanyOptions {
    /** Same-origin route. Defaults to `/api/visitor-company`. */
    endpoint?: string;
    posthog?: PostHogLike;
    /**
     * When true, also call `posthog.group("company", domain, ...)`.
     * Group Analytics is a paid PostHog add-on, so this stays off unless you opt in.
     */
    groupAnalytics?: boolean;
    fetch?: typeof fetch;
    sessionStore?: SessionStore | null;
}
/**
 * Ask the site's visitor-company route once per browser session and copy the
 * company fields onto the current PostHog user. Does nothing harmful if PostHog
 * is missing. Never sends a person identifier of its own.
 */
export declare function rememberVisitorCompany(options?: RememberVisitorCompanyOptions): Promise<VisitorCompanyResult | null>;
/** Flat properties safe to register in PostHog. There is no IP address in here. */
export declare function companyProperties(result: VisitorCompanyResult): Record<string, string | number | null>;
//# sourceMappingURL=browser.d.ts.map
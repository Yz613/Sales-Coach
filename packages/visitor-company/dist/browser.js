const inflight = new Map();
/**
 * Ask the site's visitor-company route once per browser session and copy the
 * company fields onto the current PostHog user. Does nothing harmful if PostHog
 * is missing. Never sends a person identifier of its own.
 */
export async function rememberVisitorCompany(options = {}) {
    const endpoint = options.endpoint ?? "/api/visitor-company";
    const storageKey = `visitor-company:v1:${endpoint}`;
    const storage = options.sessionStore === undefined ? defaultSessionStore() : options.sessionStore;
    if (storage) {
        const cached = readStored(storage, storageKey);
        if (cached) {
            publish(options, cached);
            return cached;
        }
    }
    const existing = inflight.get(storageKey);
    if (existing)
        return existing;
    const pending = fetchOnce(endpoint, options.fetch ?? fetch)
        .then((result) => {
        if (result && storage)
            writeStored(storage, storageKey, result);
        if (result)
            publish(options, result);
        return result;
    })
        .finally(() => {
        inflight.delete(storageKey);
    });
    inflight.set(storageKey, pending);
    return pending;
}
/** Flat properties safe to register in PostHog. There is no IP address in here. */
export function companyProperties(result) {
    return {
        company_name: result.company_name,
        company_domain: result.company_domain,
        company_asn: result.asn,
        company_network_type: result.network_type,
        company_country: result.country,
        company_confidence: result.confidence,
        company_source: result.source,
        company_status: result.status,
        company_skip_reason: result.status === "skipped" ? result.reason : null,
    };
}
async function fetchOnce(endpoint, fetchImpl) {
    try {
        const requestInit = {
            method: "GET",
            cache: "no-store",
            credentials: "same-origin",
            headers: { accept: "application/json" },
        };
        const response = await fetchImpl(endpoint, requestInit);
        if (!response.ok)
            return null;
        const body = (await response.json());
        if (body.status !== "identified" && body.status !== "skipped")
            return null;
        return body;
    }
    catch {
        return null;
    }
}
function publish(options, result) {
    const posthog = options.posthog;
    if (!posthog)
        return;
    const properties = companyProperties(result);
    try {
        posthog.register(properties);
    }
    catch {
        // Analytics must not break the page.
    }
    try {
        posthog.setPersonProperties?.(properties);
    }
    catch {
        // Ignore a PostHog build without person properties.
    }
    if (options.groupAnalytics === true && result.status === "identified" && result.company_domain) {
        try {
            posthog.group?.("company", result.company_domain, {
                name: result.company_name,
                domain: result.company_domain,
                asn: result.asn,
                network_type: result.network_type,
            });
        }
        catch {
            // Group Analytics may be unavailable.
        }
    }
}
function defaultSessionStore() {
    try {
        const root = globalThis;
        return root.sessionStorage ?? null;
    }
    catch {
        return null;
    }
}
function readStored(storage, key) {
    try {
        const raw = storage.getItem(key);
        if (!raw)
            return null;
        const parsed = JSON.parse(raw);
        if (parsed.status !== "identified" && parsed.status !== "skipped")
            return null;
        return parsed;
    }
    catch {
        return null;
    }
}
function writeStored(storage, key, result) {
    try {
        storage.setItem(key, JSON.stringify(result));
    }
    catch {
        // Private mode and full storage are not fatal.
    }
}
//# sourceMappingURL=browser.js.map
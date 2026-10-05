export async function fetchJson(url, fetchImpl, timeoutMs) {
    try {
        const response = await fetchImpl(url, {
            method: "GET",
            headers: {
                accept: "application/json",
                "user-agent": "visitor-company",
            },
            signal: AbortSignal.timeout(timeoutMs),
        });
        if (!response.ok)
            return null;
        return await response.json();
    }
    catch {
        return null;
    }
}
export function asRecord(value) {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return null;
    return value;
}
export function asString(value) {
    return typeof value === "string" && value.trim() ? value : null;
}
//# sourceMappingURL=http.js.map
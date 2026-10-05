import { identifyVisitor } from "./identify.js";
import { parseAsn } from "./ip.js";
const JSON_HEADERS = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
};
/**
 * Read the Cloudflare visitor fields this package uses.
 * `CF-Connecting-IP` is the client address Cloudflare sets. It is not echoed back.
 */
export function readVisitorInput(request) {
    const cf = request.cf;
    const headers = request.headers;
    return {
        ip: headers.get("CF-Connecting-IP"),
        asn: parseAsn(cf?.asn),
        asOrganization: cf?.asOrganization ?? null,
        country: cf?.country ?? null,
        isEUCountry: cf?.isEUCountry === true,
        userAgent: headers.get("User-Agent"),
        doNotTrack: headers.get("DNT")?.trim() === "1",
        globalPrivacyControl: headers.get("Sec-GPC")?.trim() === "1",
        verifiedBot: cf?.botManagement?.verifiedBot === true,
    };
}
export async function identifyVisitorFromRequest(request, options = {}) {
    return identifyVisitor(readVisitorInput(request), options);
}
/**
 * `GET /api/visitor-company` handler. The response is `Cache-Control: no-store`
 * because it is specific to the caller and must not be cached by a shared CDN.
 */
export function createVisitorCompanyHandler(options = {}) {
    return async function visitorCompanyHandler(request) {
        if (request.method !== "GET" && request.method !== "HEAD") {
            return new Response(JSON.stringify({ error: "method_not_allowed" }), {
                status: 405,
                headers: JSON_HEADERS,
            });
        }
        const result = await identifyVisitorFromRequest(request, options);
        return new Response(request.method === "HEAD" ? null : JSON.stringify(result), {
            status: 200,
            headers: JSON_HEADERS,
        });
    };
}
//# sourceMappingURL=worker.js.map
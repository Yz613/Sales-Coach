import { createIpapiProvider } from "./ipapi.js";
import { createIpinfoProvider } from "./ipinfo.js";
/** IPinfo Lite first, ipapi.is only when a key is configured. Explicit `providers` replace both. */
export function providersFromOptions(options) {
    if (options.providers)
        return options.providers;
    const providers = [];
    const fetchImpl = options.fetch;
    const timeoutMs = options.timeoutMs;
    if (options.ipinfoToken) {
        providers.push(createIpinfoProvider({
            token: options.ipinfoToken,
            ...(fetchImpl ? { fetch: fetchImpl } : {}),
            ...(timeoutMs !== undefined ? { timeoutMs } : {}),
        }));
    }
    if (options.ipapiKey) {
        providers.push(createIpapiProvider({
            apiKey: options.ipapiKey,
            ...(fetchImpl ? { fetch: fetchImpl } : {}),
            ...(timeoutMs !== undefined ? { timeoutMs } : {}),
        }));
    }
    return providers;
}
//# sourceMappingURL=defaults.js.map
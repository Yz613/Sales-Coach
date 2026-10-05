import { cleanDomain, cleanName, parseAsn } from "../ip.js";
import type { CompanyProvider, ProviderResult } from "../types.js";
import { asRecord, asString, fetchJson } from "./http.js";

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
export function createIpinfoProvider(options: IpinfoProviderOptions): CompanyProvider {
  const fetchImpl = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? 2000;
  const baseUrl = (options.baseUrl ?? "https://api.ipinfo.io/lite").replace(/\/$/, "");

  return {
    name: "ipinfo",
    async lookup({ ip }) {
      if (!ip || !options.token) return null;
      const url = `${baseUrl}/${encodeURIComponent(ip)}?token=${encodeURIComponent(options.token)}`;
      const body = asRecord(await fetchJson(url, fetchImpl, timeoutMs));
      if (!body || (body.error && !body.asn)) return null;
      const result: ProviderResult = {
        companyName: cleanName(asString(body.as_name)),
        companyDomain: cleanDomain(asString(body.as_domain)),
        asn: parseAsn(body.asn),
        asOrganization: cleanName(asString(body.as_name)),
        countryCode: typeof body.country_code === "string" ? body.country_code : null,
        networkType: null,
        skipReason: null,
      };
      if (!result.companyName && !result.companyDomain && result.asn == null) return null;
      return result;
    },
  };
}

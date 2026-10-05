import { cleanDomain, cleanName, parseAsn } from "../ip.js";
import type { CompanyProvider, NetworkType, ProviderResult, SkipReason } from "../types.js";
import { asRecord, asString, fetchJson } from "./http.js";

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
export function createIpapiProvider(options: IpapiProviderOptions): CompanyProvider {
  const fetchImpl = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? 2000;
  const baseUrl = (options.baseUrl ?? "https://api.ipapi.is").replace(/\/$/, "");

  return {
    name: "ipapi",
    async lookup({ ip }) {
      if (!ip || !options.apiKey) return null;
      const url = `${baseUrl}/?q=${encodeURIComponent(ip)}&key=${encodeURIComponent(options.apiKey)}`;
      const body = asRecord(await fetchJson(url, fetchImpl, timeoutMs));
      if (!body || body.error) return null;
      return parseIpapi(body);
    },
  };
}

function parseIpapi(body: Record<string, unknown>): ProviderResult | null {
  if (body.is_bogon === true) return null;

  const company = asRecord(body.company);
  const asn = asRecord(body.asn);
  const companyName = cleanName(company ? asString(company.name) : null) ?? cleanName(asString(body.company));
  const companyDomain = cleanDomain(company ? asString(company.domain) : null) ?? cleanDomain(asn ? asString(asn.domain) : null);
  const companyType = company ? asString(company.type) : null;
  const asnType = asn ? asString(asn.type) : null;
  const rawType = companyType ?? asnType;
  const mapped = mapIpapiType(rawType);

  let networkType = mapped.networkType;
  let skipReason = mapped.skipReason;

  if (body.is_vpn === true || body.is_tor === true || body.is_proxy === true) {
    networkType = "vpn";
    skipReason = "vpn";
  } else if (body.is_mobile === true) {
    networkType = "mobile";
    skipReason = "mobile_carrier";
  } else if (
    body.is_datacenter === true &&
    rawType !== "education" &&
    rawType !== "government" &&
    rawType !== "banking" &&
    rawType !== "isp"
  ) {
    // A named business inside a datacenter is usually a hosted server, not an office.
    networkType = "hosting";
    skipReason = "hosting_provider";
  }

  if (!companyName && !companyDomain && !skipReason && parseAsn(asn?.asn) == null) return null;

  return {
    companyName,
    companyDomain,
    asn: parseAsn(asn?.asn),
    asOrganization: cleanName(asn ? asString(asn.org) : null) ?? companyName,
    countryCode: countryCode(body),
    networkType,
    skipReason,
  };
}

function mapIpapiType(type: string | null): { networkType: NetworkType | null; skipReason: SkipReason | null } {
  switch (type) {
    case "isp":
      return { networkType: "isp", skipReason: "residential_isp" };
    case "hosting":
      return { networkType: "hosting", skipReason: "hosting_provider" };
    case "education":
      return { networkType: "educational", skipReason: null };
    case "government":
      return { networkType: "government", skipReason: null };
    case "banking":
    case "business":
      return { networkType: "enterprise", skipReason: null };
    default:
      return { networkType: null, skipReason: null };
  }
}

function countryCode(body: Record<string, unknown>): string | null {
  const location = asRecord(body.location);
  const code = location ? asString(location.country_code) : null;
  return code;
}

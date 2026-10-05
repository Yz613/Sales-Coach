import type { NetworkType, SkipReason } from "./types.js";

export interface KeywordMatch {
  networkType: NetworkType;
  reason: SkipReason | null;
}

interface KeywordRule {
  pattern: RegExp;
  networkType: NetworkType;
  reason: SkipReason | null;
}

/**
 * High-precision organization-name rules. These catch networks that are missing
 * from the ASN lists. Deny rules are intentionally narrower than a bag of
 * generic words like "communications", which would swallow real companies.
 */
const DENY_RULES: readonly KeywordRule[] = [
  {
    pattern:
      /\b(nord\s?vpn|express\s?vpn|surfshark|mullvad|cyberghost|windscribe|ipvanish|proton\s?vpn|private internet access|tunnelbear|hidemyass|hide\.me|azire\s?vpn|airvpn|torguard|cloudflare\s*warp|m247)\b|\bvpn\b/i,
    networkType: "vpn",
    reason: "vpn",
  },
  {
    pattern:
      /\b(t-mobile|tmobile|verizon wireless|vodafone|china mobile|docomo|ee limited|cricket wireless|boost mobile|metro\s?pcs|reliance jio)\b|\b(wireless|cellular|mobility)\b/i,
    networkType: "mobile",
    reason: "mobile_carrier",
  },
  {
    pattern:
      /\b(amazon(\.com)?|amazon web services|amazon data services|google cloud|google llc|microsoft corporation|digitalocean|hetzner|ovh|linode|vultr|constant company|scaleway|contabo|leaseweb|akamai|fastly|cloudflare|softlayer|oracle cloud|alibaba|tencent cloud|colocrossing|frantech|hostinger|ionos|godaddy|namecheap|bluehost|upcloud|netcup|datacamp|cdn77|clouvider|selectel|packethub|packet hub)\b|\b(hosting|datacenter|data center|colocation)\b/i,
    networkType: "hosting",
    reason: "hosting_provider",
  },
  {
    pattern:
      /\b(comcast|xfinity|charter communications|time warner|cox communications|centurylink|frontier communications|windstream|mediacom|cablevision|starlink|spacex|space exploration technologies|hughes network|google fiber|virgin media|talktalk|deutsche telekom|telefonica|telstra|rogers communications|bell canada|shaw communications|china telecom|china unicom|sk broadband|softbank|bharti airtel|swisscom|bouygues|verizon|at&t)\b|\b(telecom|telekom|telecommunications|broadband|cable)\b/i,
    networkType: "isp",
    reason: "residential_isp",
  },
];

const ALLOW_RULES: readonly KeywordRule[] = [
  {
    pattern: /\b(university|universit[aä]t|college|polytechnic|school district|institute of technology)\b/i,
    networkType: "educational",
    reason: null,
  },
  {
    pattern: /\b(department of|ministry of|city of|county of|state of|government)\b/i,
    networkType: "government",
    reason: null,
  },
];

/** Domains that identify a cloud, host, or carrier rather than the visitor's employer. */
const DENY_DOMAINS: Readonly<Record<string, KeywordMatch>> = {
  "amazon.com": { networkType: "hosting", reason: "hosting_provider" },
  "amazonaws.com": { networkType: "hosting", reason: "hosting_provider" },
  "aws.amazon.com": { networkType: "hosting", reason: "hosting_provider" },
  "google.com": { networkType: "hosting", reason: "hosting_provider" },
  "cloud.google.com": { networkType: "hosting", reason: "hosting_provider" },
  "microsoft.com": { networkType: "hosting", reason: "hosting_provider" },
  "azure.com": { networkType: "hosting", reason: "hosting_provider" },
  "cloudflare.com": { networkType: "hosting", reason: "hosting_provider" },
  "digitalocean.com": { networkType: "hosting", reason: "hosting_provider" },
  "ovh.com": { networkType: "hosting", reason: "hosting_provider" },
  "ovhcloud.com": { networkType: "hosting", reason: "hosting_provider" },
  "hetzner.com": { networkType: "hosting", reason: "hosting_provider" },
  "linode.com": { networkType: "hosting", reason: "hosting_provider" },
  "akamai.com": { networkType: "hosting", reason: "hosting_provider" },
  "fastly.com": { networkType: "hosting", reason: "hosting_provider" },
  "oracle.com": { networkType: "hosting", reason: "hosting_provider" },
  "vultr.com": { networkType: "hosting", reason: "hosting_provider" },
  "comcast.com": { networkType: "isp", reason: "residential_isp" },
  "xfinity.com": { networkType: "isp", reason: "residential_isp" },
  "spectrum.com": { networkType: "isp", reason: "residential_isp" },
  "charter.com": { networkType: "isp", reason: "residential_isp" },
  "cox.com": { networkType: "isp", reason: "residential_isp" },
  "att.com": { networkType: "isp", reason: "residential_isp" },
  "verizon.com": { networkType: "isp", reason: "residential_isp" },
  "t-mobile.com": { networkType: "mobile", reason: "mobile_carrier" },
};

export function matchDenyKeyword(name: string): KeywordMatch | null {
  for (const rule of DENY_RULES) {
    if (rule.pattern.test(name)) {
      return { networkType: rule.networkType, reason: rule.reason };
    }
  }
  return null;
}

export function matchAllowKeyword(name: string): KeywordMatch | null {
  for (const rule of ALLOW_RULES) {
    if (rule.pattern.test(name)) {
      return { networkType: rule.networkType, reason: null };
    }
  }
  return null;
}

export function matchDenyDomain(domain: string): KeywordMatch | null {
  const normalized = domain.trim().toLowerCase().replace(/\.$/, "");
  if (DENY_DOMAINS[normalized]) return DENY_DOMAINS[normalized];
  const labels = normalized.split(".");
  if (labels.length > 2) {
    const parent = labels.slice(1).join(".");
    if (DENY_DOMAINS[parent]) return DENY_DOMAINS[parent];
  }
  return null;
}

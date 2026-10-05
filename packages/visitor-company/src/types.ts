/** How the visitor's network relates to a single organization. */
export type NetworkType =
  | "enterprise"
  | "educational"
  | "government"
  | "nonprofit"
  | "isp"
  | "mobile"
  | "vpn"
  | "hosting"
  | "transit"
  | "content"
  | "unknown";

export type Confidence = "high" | "medium" | "low";

/** Why a visitor was not resolved to a company. */
export type SkipReason =
  | "eu_privacy"
  | "privacy_signal"
  | "bot"
  | "residential_isp"
  | "mobile_carrier"
  | "vpn"
  | "hosting_provider"
  | "transit_provider"
  | "content_network"
  | "no_signal"
  | "unresolved";

export type MatchSource = "override" | "keyword" | "curated" | "peeringdb" | "none";

/**
 * Signals already available on the request. The IP is used only as a lookup
 * key for optional enrichment providers. It is never returned or cached.
 */
export interface VisitorInput {
  ip?: string | null;
  asn?: number | string | null;
  asOrganization?: string | null;
  country?: string | null;
  isEUCountry?: boolean;
  userAgent?: string | null;
  doNotTrack?: boolean;
  globalPrivacyControl?: boolean;
  /** Set when the edge already knows this client is a verified bot. */
  verifiedBot?: boolean;
}

export type VisitorCompanyResult =
  | {
      status: "identified";
      company_name: string | null;
      company_domain: string | null;
      asn: number | null;
      network_type: NetworkType;
      country: string | null;
      confidence: Confidence;
      source: string;
      reason: null;
    }
  | {
      status: "skipped";
      reason: SkipReason;
      company_name: null;
      company_domain: null;
      asn: number | null;
      network_type: NetworkType;
      country: string | null;
      confidence: null;
      source: string | null;
    };

export interface ProviderLookup {
  ip?: string | null;
  asn?: number | null;
  asOrganization?: string | null;
}

/** What an enrichment provider learned. `skipReason` means the network is not a company. */
export interface ProviderResult {
  companyName: string | null;
  companyDomain: string | null;
  asn: number | null;
  asOrganization: string | null;
  countryCode: string | null;
  networkType: NetworkType | null;
  skipReason: SkipReason | null;
}

export interface CompanyProvider {
  readonly name: string;
  lookup(input: ProviderLookup): Promise<ProviderResult | null>;
}

/** Cached company decision. Raw IP addresses are not part of this value. */
export interface CacheEntry {
  status: "identified" | "skipped";
  reason: SkipReason | null;
  companyName: string | null;
  companyDomain: string | null;
  asn: number | null;
  networkType: NetworkType;
  confidence: Confidence | null;
  source: string | null;
}

export interface VisitorCache {
  get(key: string): Promise<CacheEntry | null>;
  set(key: string, entry: CacheEntry, ttlSeconds: number): Promise<void>;
}

/** The subset of Workers KV this package uses. */
export interface KvNamespaceLike {
  get(key: string, type: "json"): Promise<unknown>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

export interface IdentifyOptions {
  /** Replaces the default provider chain built from tokens. */
  providers?: readonly CompanyProvider[];
  cache?: VisitorCache;
  /** Defaults to 30 days. */
  cacheTtlSeconds?: number;
  /**
   * When true (the default), a `DNT: 1` or `Sec-GPC: 1` signal skips company
   * identification. Pass `false` to ignore those signals.
   */
  honorPrivacySignals?: boolean;
  /** ISO 3166-1 alpha-2 codes treated like the EU. Defaults to EU + UK + EEA. */
  privacyCountries?: readonly string[];
  /** Per-ASN classifications that override the built-in curated list and PeeringDB. */
  networks?: ReadonlyMap<number, NetworkType> | Readonly<Record<number, NetworkType>>;
  /** IPinfo Lite token. Omit to skip IPinfo. */
  ipinfoToken?: string;
  /** ipapi.is key. Omit to skip the fallback. */
  ipapiKey?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

/** Fields read from `request.cf` on Cloudflare Workers. Other properties are ignored. */
export interface CfVisitorProperties {
  asn?: number | string;
  asOrganization?: string;
  country?: string;
  isEUCountry?: boolean;
  botManagement?: { verifiedBot?: boolean };
}

export interface Classification {
  networkType: NetworkType;
  matchedBy: MatchSource;
  filtered: boolean;
  reason: SkipReason | null;
}

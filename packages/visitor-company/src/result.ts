import type { CacheEntry, Confidence, NetworkType, SkipReason, VisitorCompanyResult } from "./types.js";

export function skipped(fields: {
  reason: SkipReason;
  asn?: number | null;
  country?: string | null;
  networkType?: NetworkType;
  source?: string | null;
}): VisitorCompanyResult {
  return {
    status: "skipped",
    reason: fields.reason,
    company_name: null,
    company_domain: null,
    asn: fields.asn ?? null,
    network_type: fields.networkType ?? "unknown",
    country: fields.country ?? null,
    confidence: null,
    source: fields.source ?? null,
  };
}

export function identified(fields: {
  companyName: string | null;
  companyDomain: string | null;
  asn: number | null;
  networkType: NetworkType;
  country: string | null;
  confidence: Confidence;
  source: string;
}): VisitorCompanyResult {
  return {
    status: "identified",
    company_name: fields.companyName,
    company_domain: fields.companyDomain,
    asn: fields.asn,
    network_type: fields.networkType,
    country: fields.country,
    confidence: fields.confidence,
    source: fields.source,
    reason: null,
  };
}

export function toCacheEntry(result: VisitorCompanyResult): CacheEntry {
  return {
    status: result.status,
    reason: result.reason,
    companyName: result.company_name,
    companyDomain: result.company_domain,
    asn: result.asn,
    networkType: result.network_type,
    confidence: result.confidence,
    source: result.source,
  };
}

/** Country always comes from the current request, never from a cached visitor. */
export function fromCacheEntry(entry: CacheEntry, country: string | null): VisitorCompanyResult {
  if (entry.status === "skipped" && entry.reason) {
    return skipped({
      reason: entry.reason,
      asn: entry.asn,
      country,
      networkType: entry.networkType,
      source: entry.source,
    });
  }
  return identified({
    companyName: entry.companyName,
    companyDomain: entry.companyDomain,
    asn: entry.asn,
    networkType: entry.networkType,
    country,
    confidence: entry.confidence ?? "low",
    source: entry.source ?? "cache",
  });
}

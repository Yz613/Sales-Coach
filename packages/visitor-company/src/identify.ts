import { isObviousBot } from "./bots.js";
import { DEFAULT_CACHE_TTL_SECONDS, isCacheEntry, visitorCacheKey } from "./cache.js";
import { classifyNetwork, isOrganizationType } from "./classify.js";
import { cleanName, isPublicIp, normalizeCountry, parseAsn } from "./ip.js";
import { matchDenyDomain, matchDenyKeyword } from "./keywords.js";
import { isPrivacyRegion } from "./privacy.js";
import { providersFromOptions } from "./providers/defaults.js";
import { fromCacheEntry, identified, skipped, toCacheEntry } from "./result.js";
import type {
  CompanyProvider,
  Confidence,
  IdentifyOptions,
  NetworkType,
  ProviderLookup,
  ProviderResult,
  VisitorCompanyResult,
  VisitorInput,
} from "./types.js";

/**
 * Resolve the organization behind a visitor's network.
 * The IP is sent only to configured enrichment providers, and only after
 * bot, EU/UK/EEA, and privacy-signal checks. It is not part of the result.
 */
export async function identifyVisitor(
  input: VisitorInput,
  options: IdentifyOptions = {},
): Promise<VisitorCompanyResult> {
  const asn = parseAsn(input.asn);
  const country = normalizeCountry(input.country);
  const org = cleanName(input.asOrganization);
  const publicIp = typeof input.ip === "string" && isPublicIp(input.ip) ? input.ip : null;
  const privacyCountries = options.privacyCountries;

  if (isObviousBot({ userAgent: input.userAgent, verifiedBot: input.verifiedBot })) {
    return skipped({ reason: "bot", asn, country });
  }

  if (isPrivacyRegion({ country, isEUCountry: input.isEUCountry === true, ...(privacyCountries ? { countries: privacyCountries } : {}) })) {
    return skipped({ reason: "eu_privacy", country });
  }

  if (options.honorPrivacySignals !== false && (input.doNotTrack === true || input.globalPrivacyControl === true)) {
    return skipped({ reason: "privacy_signal", country });
  }

  const local = classifyNetwork({
    asn,
    asOrganization: org,
    ...(options.networks ? { networks: options.networks } : {}),
  });
  if (local.filtered && local.reason) {
    return skipped({ reason: local.reason, asn, country, networkType: local.networkType });
  }

  const cacheKey = visitorCacheKey({ asn, ip: publicIp });
  if (options.cache && cacheKey) {
    const hit = await options.cache.get(cacheKey);
    if (hit && isCacheEntry(hit)) return fromCacheEntry(hit, country);
  }

  if (asn == null && !org && !publicIp) {
    return skipped({ reason: "no_signal", country });
  }

  const providers = providersFromOptions(options);
  let enrichment: ProviderResult | null = null;
  let enrichmentSource: string | null = null;
  if (publicIp && providers.length > 0) {
    const lookedUp = await lookupWithFallback(providers, { ip: publicIp, asn, asOrganization: org });
    enrichment = lookedUp.result;
    enrichmentSource = lookedUp.source;
  }

  const resolvedCountry = country ?? normalizeCountry(enrichment?.countryCode);
  if (
    resolvedCountry &&
    isPrivacyRegion({
      country: resolvedCountry,
      ...(privacyCountries ? { countries: privacyCountries } : {}),
    })
  ) {
    return skipped({ reason: "eu_privacy", country: resolvedCountry });
  }

  const resolvedAsn = enrichment?.asn ?? asn;

  if (enrichment?.skipReason) {
    const networkType = enrichment.networkType ?? networkTypeForSkip(enrichment.skipReason);
    const result = skipped({
      reason: enrichment.skipReason,
      asn: resolvedAsn,
      country: resolvedCountry,
      networkType,
      source: enrichmentSource,
    });
    await writeCache(options, cacheKey, result, true);
    return result;
  }

  for (const name of [enrichment?.companyName, enrichment?.asOrganization, org]) {
    if (!name) continue;
    const denied = matchDenyKeyword(name);
    if (denied?.reason) {
      const result = skipped({
        reason: denied.reason,
        asn: resolvedAsn,
        country: resolvedCountry,
        networkType: denied.networkType,
        source: enrichmentSource,
      });
      await writeCache(options, cacheKey, result, enrichment != null);
      return result;
    }
  }

  const domain = enrichment?.companyDomain ?? null;
  if (domain) {
    const deniedDomain = matchDenyDomain(domain);
    if (deniedDomain?.reason) {
      const result = skipped({
        reason: deniedDomain.reason,
        asn: resolvedAsn,
        country: resolvedCountry,
        networkType: deniedDomain.networkType,
        source: enrichmentSource,
      });
      await writeCache(options, cacheKey, result, true);
      return result;
    }
  }

  const networkType = pickNetworkType(local.networkType, enrichment?.networkType ?? null);
  const companyName = cleanName(enrichment?.companyName) ?? org;
  if (!companyName && !domain) {
    return skipped({ reason: "unresolved", asn: resolvedAsn, country: resolvedCountry, networkType });
  }

  const usedProvider = Boolean(enrichment && (enrichment.companyDomain || enrichment.companyName || enrichment.asOrganization));
  const result = identified({
    companyName,
    companyDomain: domain,
    asn: resolvedAsn,
    networkType,
    country: resolvedCountry,
    confidence: confidenceFor(networkType, Boolean(domain)),
    source: usedProvider && enrichmentSource ? enrichmentSource : "asn",
  });
  await writeCache(options, cacheKey, result, usedProvider);
  return result;
}

async function lookupWithFallback(
  providers: readonly CompanyProvider[],
  input: ProviderLookup,
): Promise<{ result: ProviderResult | null; source: string | null }> {
  let accumulated: ProviderResult | null = null;
  let source: string | null = null;

  for (const provider of providers) {
    let result: ProviderResult | null = null;
    try {
      result = await provider.lookup(input);
    } catch {
      result = null;
    }
    if (!result) continue;
    if (result.skipReason) return { result, source: provider.name };

    if (!accumulated) {
      accumulated = result;
      source = provider.name;
    } else {
      const domain: string | null = accumulated.companyDomain ?? result.companyDomain;
      accumulated = {
        companyName: accumulated.companyName ?? result.companyName,
        companyDomain: domain,
        asn: accumulated.asn ?? result.asn,
        asOrganization: accumulated.asOrganization ?? result.asOrganization,
        countryCode: accumulated.countryCode ?? result.countryCode,
        networkType: result.networkType && result.networkType !== "unknown" ? result.networkType : accumulated.networkType,
        skipReason: null,
      };
      if (result.companyDomain) source = provider.name;
    }
    if (accumulated.companyDomain) break;
  }

  return { result: accumulated, source };
}

function pickNetworkType(local: NetworkType, enriched: NetworkType | null): NetworkType {
  if (enriched && isOrganizationType(enriched)) return enriched;
  if (isOrganizationType(local)) return local;
  if (enriched && enriched !== "unknown") return enriched;
  return local;
}

function confidenceFor(networkType: NetworkType, hasDomain: boolean): Confidence {
  const typed = isOrganizationType(networkType);
  if (hasDomain && typed) return "high";
  if (hasDomain || typed) return "medium";
  return "low";
}

function networkTypeForSkip(reason: ProviderResult["skipReason"]): NetworkType {
  switch (reason) {
    case "residential_isp":
      return "isp";
    case "mobile_carrier":
      return "mobile";
    case "vpn":
      return "vpn";
    case "hosting_provider":
      return "hosting";
    case "transit_provider":
      return "transit";
    case "content_network":
      return "content";
    default:
      return "unknown";
  }
}

async function writeCache(
  options: IdentifyOptions,
  key: string | null,
  result: VisitorCompanyResult,
  providerContributed: boolean,
): Promise<void> {
  if (!options.cache || !key || !providerContributed) return;
  const ttl = options.cacheTtlSeconds ?? DEFAULT_CACHE_TTL_SECONDS;
  await options.cache.set(key, toCacheEntry(result), ttl);
}

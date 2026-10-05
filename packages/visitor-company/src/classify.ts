import { CURATED_NETWORKS } from "./data/curated-networks.js";
import { peeringDbNetworks } from "./data/peeringdb-networks.js";
import { cleanName, parseAsn } from "./ip.js";
import { matchAllowKeyword, matchDenyKeyword } from "./keywords.js";
import type { Classification, MatchSource, NetworkType, SkipReason } from "./types.js";

const SKIP_REASON: Record<NetworkType, SkipReason | null> = {
  enterprise: null,
  educational: null,
  government: null,
  nonprofit: null,
  unknown: null,
  isp: "residential_isp",
  mobile: "mobile_carrier",
  vpn: "vpn",
  hosting: "hosting_provider",
  transit: "transit_provider",
  content: "content_network",
};

let peeringDbMap: Map<number, NetworkType> | null = null;

/** ASN classifications generated from PeeringDB. Built once, on first use. */
export function loadPeeringDbNetworks(): ReadonlyMap<number, NetworkType> {
  if (!peeringDbMap) {
    peeringDbMap = new Map();
    for (const [type, asns] of Object.entries(peeringDbNetworks)) {
      if (!(type in SKIP_REASON) || type === "unknown") continue;
      for (const asn of asns) peeringDbMap.set(asn, type as NetworkType);
    }
  }
  return peeringDbMap;
}

export function skipReasonFor(networkType: NetworkType): SkipReason | null {
  return SKIP_REASON[networkType];
}

export function isOrganizationType(networkType: NetworkType): boolean {
  return (
    networkType === "enterprise" ||
    networkType === "educational" ||
    networkType === "government" ||
    networkType === "nonprofit"
  );
}

/**
 * Decide whether an ASN / organization name belongs to one organization or to
 * a shared access network. Caller overrides win, then deny keywords, then the
 * curated ASN list, then the PeeringDB snapshot, then allow keywords.
 */
export function classifyNetwork(input: {
  asn?: number | string | null;
  asOrganization?: string | null;
  networks?: ReadonlyMap<number, NetworkType> | Readonly<Record<number, NetworkType>>;
}): Classification {
  const asn = parseAsn(input.asn);
  const override = asn == null ? undefined : lookupOverride(input.networks, asn);
  if (override && override in SKIP_REASON) return classification(override, "override");

  const org = cleanName(input.asOrganization);
  const denied = org ? matchDenyKeyword(org) : null;
  if (denied?.reason && denied.networkType in SKIP_REASON) {
    return classification(denied.networkType, "keyword");
  }

  if (asn != null) {
    const curated = CURATED_NETWORKS[asn];
    if (curated) return classification(curated, "curated");
    const peering = loadPeeringDbNetworks().get(asn);
    if (peering) return classification(peering, "peeringdb");
  }

  const allowed = org ? matchAllowKeyword(org) : null;
  if (allowed) return classification(allowed.networkType, "keyword");

  return classification("unknown", "none");
}

function classification(networkType: NetworkType, matchedBy: MatchSource): Classification {
  const reason = skipReasonFor(networkType);
  return {
    networkType,
    matchedBy,
    filtered: reason != null,
    reason,
  };
}

function lookupOverride(
  networks: ReadonlyMap<number, NetworkType> | Readonly<Record<number, NetworkType>> | undefined,
  asn: number,
): NetworkType | undefined {
  if (!networks) return undefined;
  if (networks instanceof Map) return networks.get(asn);
  const record = networks as Readonly<Record<number, NetworkType>>;
  return record[asn];
}

import type { NetworkType } from "../types.js";
/**
 * Hand-maintained networks that do not identify a visitor's employer.
 * Holder names were checked against RIPE Stat on 2026-10-05.
 * `npm run refresh-asns` adds the long tail from PeeringDB; entries here win
 * so a mobile carrier is not reported as a generic ISP, and so well-known
 * clouds stay filtered even if the snapshot is stale.
 */
export declare const CURATED_NETWORKS: Readonly<Record<number, NetworkType>>;
//# sourceMappingURL=curated-networks.d.ts.map
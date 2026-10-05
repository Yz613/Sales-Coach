import type { NetworkType } from "./types.js";
/**
 * Map PeeringDB `info_type` / `info_types` onto a visitor-identification class.
 *
 * Cable/DSL/ISP, NSP, and Content do not tell you the visitor's employer.
 * Enterprise, education, government, and non-profit networks do.
 * ISP wins over every other label. An organization label wins over NSP/Content
 * when a network is tagged with both.
 */
export declare function networkTypeFromPeeringDb(infoTypes: readonly string[] | null | undefined, infoType?: string | null): NetworkType | null;
//# sourceMappingURL=peeringdb.d.ts.map
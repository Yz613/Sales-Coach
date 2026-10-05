import type { NetworkType } from "./types.js";

/**
 * Map PeeringDB `info_type` / `info_types` onto a visitor-identification class.
 *
 * Cable/DSL/ISP, NSP, and Content do not tell you the visitor's employer.
 * Enterprise, education, government, and non-profit networks do.
 * ISP wins over every other label. An organization label wins over NSP/Content
 * when a network is tagged with both.
 */
export function networkTypeFromPeeringDb(
  infoTypes: readonly string[] | null | undefined,
  infoType?: string | null,
): NetworkType | null {
  const types = new Set<string>();
  if (infoType) types.add(infoType);
  if (infoTypes) {
    for (const type of infoTypes) types.add(type);
  }

  if (types.has("Cable/DSL/ISP")) return "isp";
  if (types.has("Government")) return "government";
  if (types.has("Educational/Research")) return "educational";
  if (types.has("Enterprise")) return "enterprise";
  if (types.has("Non-Profit")) return "nonprofit";
  if (types.has("NSP")) return "transit";
  if (types.has("Content")) return "content";
  return null;
}

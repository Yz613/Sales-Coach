import type { IdentifyOptions, VisitorCompanyResult, VisitorInput } from "./types.js";
/**
 * Resolve the organization behind a visitor's network.
 * The IP is sent only to configured enrichment providers, and only after
 * bot, EU/UK/EEA, and privacy-signal checks. It is not part of the result.
 */
export declare function identifyVisitor(input: VisitorInput, options?: IdentifyOptions): Promise<VisitorCompanyResult>;
//# sourceMappingURL=identify.d.ts.map
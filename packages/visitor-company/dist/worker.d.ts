import { identifyVisitor } from "./identify.js";
import type { IdentifyOptions, VisitorInput } from "./types.js";
/**
 * Read the Cloudflare visitor fields this package uses.
 * `CF-Connecting-IP` is the client address Cloudflare sets. It is not echoed back.
 */
export declare function readVisitorInput(request: Request): VisitorInput;
export declare function identifyVisitorFromRequest(request: Request, options?: IdentifyOptions): Promise<ReturnType<typeof identifyVisitor>>;
/**
 * `GET /api/visitor-company` handler. The response is `Cache-Control: no-store`
 * because it is specific to the caller and must not be cached by a shared CDN.
 */
export declare function createVisitorCompanyHandler(options?: IdentifyOptions): (request: Request) => Promise<Response>;
//# sourceMappingURL=worker.d.ts.map
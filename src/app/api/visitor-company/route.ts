import { handleVisitorCompany } from "@/lib/visitor-company";

export const dynamic = "force-dynamic";

/**
 * Public company lookup for the current visitor.
 * Served at `/app/api/visitor-company` because Next `basePath` is `/app`,
 * which is on the sales-coach Worker (`refreshqueue.com/*`).
 * `request.cf` is filled from the OpenNext Cloudflare context when the
 * framework request does not carry it.
 */
export function GET(request: Request): Promise<Response> {
  return handleVisitorCompany(request);
}

export function HEAD(request: Request): Promise<Response> {
  return handleVisitorCompany(request);
}

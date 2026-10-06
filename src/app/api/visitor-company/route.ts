import { handleVisitorCompany } from "@/lib/visitor-company";
import { consumeLimit } from "@/lib/security-rate-limit";
import { SecurityPolicyError } from "@/lib/security-policy";

export const dynamic = "force-dynamic";

async function rateLimitedVisitorCompany(request: Request): Promise<Response> {
  const ip =
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "anon";
  try {
    await consumeLimit(`visitor-company:${ip}`, 60);
    await consumeLimit("visitor-company:global", 1200);
  } catch (error) {
    if (error instanceof SecurityPolicyError) {
      return new Response(request.method === "HEAD" ? null : JSON.stringify({ error: error.message }), {
        status: error.status,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }
    throw error;
  }
  return handleVisitorCompany(request);
}

/**
 * Public company lookup for the current visitor.
 * Served at `/app/api/visitor-company` because Next `basePath` is `/app`,
 * which is on the sales-coach Worker (`refreshqueue.com/*`).
 * `request.cf` is filled from the OpenNext Cloudflare context when the
 * framework request does not carry it.
 */
export function GET(request: Request): Promise<Response> {
  return rateLimitedVisitorCompany(request);
}

export function HEAD(request: Request): Promise<Response> {
  return rateLimitedVisitorCompany(request);
}

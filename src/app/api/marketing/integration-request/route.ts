import { NextResponse } from "next/server";
import {
  integrationRequestClientIp,
  submitIntegrationRequest,
} from "@/lib/integrationRequest";
import { consumeLimit } from "@/lib/security-rate-limit";
import { withPublicApi } from "@/lib/workspace";

export const dynamic = "force-dynamic";

async function POSTHandler(request: Request) {
  const body = await request.json().catch(() => null);
  const result = await submitIntegrationRequest(body, {
    ip: integrationRequestClientIp(request),
    consumeLimit,
  });
  return NextResponse.json(result.body, { status: result.status });
}

export const POST = withPublicApi(POSTHandler, { limit: 8 * 1024 });

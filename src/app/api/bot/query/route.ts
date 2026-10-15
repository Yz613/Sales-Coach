import { NextResponse } from "next/server";
import { authenticateApiToken } from "@/lib/apiTokens";
import { executeTool, resolveBotQuery } from "@/lib/mcp/tools";
import { runWithAuth, publicGuestAuth, type AuthUser } from "@/lib/auth";
import { runWithTenant, resolveTenantId, LOCAL_TENANT_ID } from "@/lib/tenant";
import { localDevelopmentAllowed } from "@/lib/security-policy";
import { requireWorkspace } from "@/lib/workspace";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const token = request.headers.get("authorization") || url.searchParams.get("key");
  let auth: AuthUser | null = await authenticateApiToken(token);

  if (!auth) {
    try {
      auth = await requireWorkspace();
    } catch {
      if (localDevelopmentAllowed()) {
        auth = publicGuestAuth();
      }
    }
  }

  if (!auth) {
    return NextResponse.json(
      { error: "Authentication required. Provide a valid Bearer token, key parameter, or sign in to your workspace." },
      { status: 401, headers: CORS_HEADERS }
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body. Expected { query: string } or { tool: string, params: object }." },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const { query, tool, params } = body || {};

  try {
    let result: { text: string; data: any };

    if (tool && typeof tool === "string") {
      result = await runWithAuth(auth, () =>
        runWithTenant(resolveTenantId(auth), () =>
          executeTool(tool, params || {}, auth)
        )
      );
    } else if (query && typeof query === "string") {
      result = await runWithAuth(auth, () =>
        runWithTenant(resolveTenantId(auth), () =>
          resolveBotQuery(query, auth)
        )
      );
    } else {
      return NextResponse.json(
        { error: "Provide either a 'query' string or 'tool' name." },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      {
        answer: result.text,
        data: result.data,
      },
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to process query." },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export const dynamic = "force-dynamic";

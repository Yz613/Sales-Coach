import { NextResponse } from "next/server";
import { authenticateApiToken } from "@/lib/apiTokens";
import { MCP_TOOL_DEFINITIONS, executeTool, resolveBotQuery } from "@/lib/mcp/tools";
import { runWithAuth, publicGuestAuth, type AuthUser } from "@/lib/auth";
import { runWithTenant, resolveTenantId, LOCAL_TENANT_ID } from "@/lib/tenant";
import { localDevelopmentAllowed } from "@/lib/security-policy";
import { requireWorkspace } from "@/lib/workspace";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const authHeader = request.headers.get("authorization") || url.searchParams.get("key");
  let auth: AuthUser | null = await authenticateApiToken(authHeader);

  if (!auth) {
    try {
      auth = await requireWorkspace();
    } catch {
      if (localDevelopmentAllowed()) {
        auth = publicGuestAuth();
      }
    }
  }

  return NextResponse.json(
    {
      name: "sales-coach-mcp",
      version: "1.0.0",
      description: "Model Context Protocol (MCP) Server for Sales Coach",
      authenticated: Boolean(auth),
      tenantId: auth ? (auth.orgId || auth.tenantId || LOCAL_TENANT_ID) : null,
      tools: MCP_TOOL_DEFINITIONS.map((t) => ({
        name: t.name,
        description: t.description,
      })),
      usage: {
        streamableHttp: "POST /app/api/mcp with Authorization: Bearer <TOKEN>",
        grokCli: "grok mcp add --transport http sales-coach <HOST>/app/api/mcp?key=<TOKEN>",
      },
    },
    { headers: CORS_HEADERS }
  );
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

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const { jsonrpc, id, method, params } = body || {};

  // Support direct query requests alongside MCP JSON-RPC protocol
  if (body?.query && typeof body.query === "string") {
    if (!auth) {
      return NextResponse.json(
        { error: "Authentication required. Provide a valid Bearer token, key parameter, or sign in to your workspace." },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    try {
      const result = await runWithAuth(auth, () =>
        runWithTenant(resolveTenantId(auth), () =>
          resolveBotQuery(body.query, auth!)
        )
      );

      return NextResponse.json(
        {
          answer: result.text,
          data: result.data,
          jsonrpc: "2.0",
          id: id ?? 1,
          result: {
            content: [
              {
                type: "text",
                text: result.text,
              },
            ],
            data: result.data,
          },
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

  // MCP JSON-RPC protocol handling
  if (method === "initialize") {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: id ?? 1,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: "sales-coach-mcp",
            version: "1.0.0",
          },
        },
      },
      { headers: CORS_HEADERS }
    );
  }

  if (method === "notifications/initialized") {
    return NextResponse.json(
      { jsonrpc: "2.0", id: id ?? null, result: {} },
      { headers: CORS_HEADERS }
    );
  }

  if (method === "tools/list") {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: id ?? 1,
        result: {
          tools: MCP_TOOL_DEFINITIONS,
        },
      },
      { headers: CORS_HEADERS }
    );
  }

  if (method === "tools/call") {
    if (!auth) {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id: id ?? 1,
          error: {
            code: -32000,
            message: "Authentication required. Provide a valid Bearer token or key parameter.",
          },
        },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const toolName = params?.name;
    const toolArgs = params?.arguments || {};

    try {
      const result = await runWithAuth(auth, () =>
        runWithTenant(resolveTenantId(auth), () =>
          executeTool(toolName, toolArgs, auth)
        )
      );

      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id: id ?? 1,
          result: {
            content: [
              {
                type: "text",
                text: result.text,
              },
            ],
            data: result.data,
          },
        },
        { headers: CORS_HEADERS }
      );
    } catch (err: any) {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id: id ?? 1,
          result: {
            isError: true,
            content: [
              {
                type: "text",
                text: `Error executing ${toolName}: ${err.message || String(err)}`,
              },
            ],
          },
        },
        { headers: CORS_HEADERS }
      );
    }
  }

  return NextResponse.json(
    {
      jsonrpc: "2.0",
      id: id ?? null,
      error: { code: -32601, message: `Method not found: ${method}` },
    },
    { status: 404, headers: CORS_HEADERS }
  );
}

export const dynamic = "force-dynamic";

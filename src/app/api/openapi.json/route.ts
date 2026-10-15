import { NextResponse } from "next/server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || url.host;
  const proto = request.headers.get("x-forwarded-proto") || (url.protocol.replace(":", "") || "https");
  const origin = `${proto}://${host}`;

  const openapiSpec = {
    openapi: "3.1.0",
    info: {
      title: "Sales Coach AI API",
      description: "API for AI teammates and bots (ChatGPT Actions, Claude, Grok, Slack, Cursor) to inspect sales call scorecards, rep coaching insights, pipeline forecasts, and quotas.",
      version: "1.0.0",
    },
    servers: [
      {
        url: `${origin}/app`,
        description: "Sales Coach App Server",
      },
    ],
    paths: {
      "/api/bot/query": {
        post: {
          operationId: "askSalesCoach",
          summary: "Ask Sales Coach questions about sales calls, coaching, forecasts, and rep performance",
          description: "Answers natural language questions about call reviews, rep coaching, quota gap, pipeline total, and win rates grounded in actual call data.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    query: {
                      type: "string",
                      description: "Question for Sales Coach, e.g. 'How many calls were ranked above 5 this week?' or 'What is our pipeline forecast?'",
                    },
                  },
                  required: ["query"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Successful response with formatted markdown answer and structured data",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      answer: {
                        type: "string",
                        description: "Natural language answer with citations and metrics",
                      },
                      data: {
                        type: "object",
                        description: "Structured query payload (e.g. calls, totals, forecasts)",
                      },
                    },
                    required: ["answer"],
                  },
                },
              },
            },
            "401": {
              description: "Authentication failed. Provide a valid Bearer token.",
            },
          },
        },
      },
      "/api/v1/chat/completions": {
        post: {
          operationId: "chatCompletions",
          summary: "OpenAI-compatible chat completions endpoint",
          description: "Standard OpenAI chat completions interface for querying Sales Coach using the official OpenAI SDK.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    model: { type: "string", default: "sales-coach" },
                    messages: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          role: { type: "string", enum: ["system", "user", "assistant"] },
                          content: { type: "string" },
                        },
                        required: ["role", "content"],
                      },
                    },
                    stream: { type: "boolean", default: false },
                  },
                  required: ["messages"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "OpenAI Chat Completion response",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                  },
                },
              },
            },
            "401": {
              description: "Authentication failed. Provide a valid Bearer token.",
            },
          },
        },
      },
      "/api/v1/messages": {
        post: {
          operationId: "createClaudeMessage",
          summary: "Anthropic Claude-compatible messages endpoint",
          description: "Standard Anthropic Claude messages interface for querying Sales Coach using the official Anthropic SDK.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    model: { type: "string", default: "sales-coach" },
                    messages: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          role: { type: "string", enum: ["user", "assistant"] },
                          content: { type: "string" },
                        },
                        required: ["role", "content"],
                      },
                    },
                    max_tokens: { type: "integer", default: 1024 },
                    stream: { type: "boolean", default: false },
                  },
                  required: ["messages"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Anthropic Message response",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                  },
                },
              },
            },
            "401": {
              description: "Authentication failed. Provide a valid Bearer or x-api-key token.",
            },
          },
        },
      },
      "/api/mcp": {
        post: {
          operationId: "callMcp",
          summary: "Model Context Protocol JSON-RPC / direct query",
          description: "Execute MCP tools (query_calls, get_forecast, get_call_details, get_rep_performance, ask_sales_coach) or natural language query.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    query: { type: "string" },
                    jsonrpc: { type: "string" },
                    id: { type: ["string", "number", "null"] },
                    method: { type: "string" },
                    params: { type: "object" },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "MCP result or answer",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                  },
                },
              },
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "sc_live_*",
          description: "API Token created in Sales Coach -> Model Context Protocol & Bots (/app/mcp). Format: Bearer sc_live_...",
        },
      },
    },
    security: [
      {
        BearerAuth: [],
      },
    ],
  };

  return NextResponse.json(openapiSpec, { headers: CORS_HEADERS });
}

export const dynamic = "force-dynamic";

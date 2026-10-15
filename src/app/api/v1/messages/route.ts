import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { authenticateApiToken } from "@/lib/apiTokens";
import { resolveBotQuery } from "@/lib/mcp/tools";
import { runWithAuth, publicGuestAuth, type AuthUser } from "@/lib/auth";
import { runWithTenant, resolveTenantId } from "@/lib/tenant";
import { localDevelopmentAllowed } from "@/lib/security-policy";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key, anthropic-version, X-Requested-With",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const token =
    request.headers.get("x-api-key") ||
    request.headers.get("authorization") ||
    url.searchParams.get("key");

  let auth: AuthUser | null = null;
  if (token) {
    auth = await authenticateApiToken(token);
    if (!auth) {
      return NextResponse.json(
        {
          type: "error",
          error: {
            type: "authentication_error",
            message: "Invalid API key provided. Token must start with 'sc_live_'.",
          },
        },
        { status: 401, headers: CORS_HEADERS }
      );
    }
  }

  if (!auth) {
    return NextResponse.json(
      {
        type: "error",
        error: {
          type: "authentication_error",
          message:
            "Missing authorization. Provide 'x-api-key: sc_live_...' or 'Authorization: Bearer sc_live_...'.",
        },
      },
      { status: 401, headers: CORS_HEADERS }
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        type: "error",
        error: {
          type: "invalid_request_error",
          message: "Malformed JSON in request body.",
        },
      },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const { model = "sales-coach", messages = [], stream = false } = body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      {
        type: "error",
        error: {
          type: "invalid_request_error",
          message: "'messages' array is required and must not be empty.",
        },
      },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // Find the latest user message
  const userMessages = messages.filter((m: any) => m && m.role === "user");
  const lastUserMessage = userMessages[userMessages.length - 1];
  const query =
    typeof lastUserMessage?.content === "string"
      ? lastUserMessage.content.trim()
      : Array.isArray(lastUserMessage?.content)
      ? lastUserMessage.content
          .map((c: any) => (typeof c === "string" ? c : c?.text || ""))
          .join(" ")
          .trim()
      : "";

  if (!query) {
    return NextResponse.json(
      {
        type: "error",
        error: {
          type: "invalid_request_error",
          message: "No user message text found in messages array.",
        },
      },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  try {
    const result = await runWithAuth(auth, () =>
      runWithTenant(resolveTenantId(auth), () =>
        resolveBotQuery(query, auth)
      )
    );

    const messageId = `msg_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
    const inputTokens = Math.max(1, Math.ceil(query.length / 4));
    const outputTokens = Math.max(1, Math.ceil(result.text.length / 4));

    // Handle Streaming (SSE Anthropic protocol)
    if (stream) {
      const encoder = new TextEncoder();
      const sseStream = new ReadableStream({
        start(controller) {
          // message_start
          const startEvent = {
            type: "message_start",
            message: {
              id: messageId,
              type: "message",
              role: "assistant",
              model,
              content: [],
              stop_reason: null,
              stop_sequence: null,
              usage: { input_tokens: inputTokens, output_tokens: 0 },
            },
          };
          controller.enqueue(
            encoder.encode(`event: message_start\ndata: ${JSON.stringify(startEvent)}\n\n`)
          );

          // content_block_start
          const blockStart = {
            type: "content_block_start",
            index: 0,
            content_block: { type: "text", text: "" },
          };
          controller.enqueue(
            encoder.encode(`event: content_block_start\ndata: ${JSON.stringify(blockStart)}\n\n`)
          );

          // content_block_delta
          const blockDelta = {
            type: "content_block_delta",
            index: 0,
            delta: { type: "text_delta", text: result.text },
          };
          controller.enqueue(
            encoder.encode(`event: content_block_delta\ndata: ${JSON.stringify(blockDelta)}\n\n`)
          );

          // content_block_stop
          const blockStop = {
            type: "content_block_stop",
            index: 0,
          };
          controller.enqueue(
            encoder.encode(`event: content_block_stop\ndata: ${JSON.stringify(blockStop)}\n\n`)
          );

          // message_delta
          const messageDelta = {
            type: "message_delta",
            delta: { stop_reason: "end_turn", stop_sequence: null },
            usage: { output_tokens: outputTokens },
          };
          controller.enqueue(
            encoder.encode(`event: message_delta\ndata: ${JSON.stringify(messageDelta)}\n\n`)
          );

          // message_stop
          const messageStop = { type: "message_stop" };
          controller.enqueue(
            encoder.encode(`event: message_stop\ndata: ${JSON.stringify(messageStop)}\n\n`)
          );

          controller.close();
        },
      });

      return new NextResponse(sseStream, {
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    // Standard Non-streaming response
    return NextResponse.json(
      {
        id: messageId,
        type: "message",
        role: "assistant",
        model,
        content: [
          {
            type: "text",
            text: result.text,
          },
        ],
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: {
          input_tokens: inputTokens,
          output_tokens: outputTokens,
        },
      },
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        type: "error",
        error: {
          type: "api_error",
          message: err?.message || "Internal server error occurred processing message.",
        },
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export const dynamic = "force-dynamic";

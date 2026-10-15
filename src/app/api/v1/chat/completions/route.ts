import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { authenticateApiToken } from "@/lib/apiTokens";
import { resolveBotQuery } from "@/lib/mcp/tools";
import { runWithAuth, publicGuestAuth } from "@/lib/auth";
import { runWithTenant, resolveTenantId } from "@/lib/tenant";
import { localDevelopmentAllowed } from "@/lib/security-policy";

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
  const auth = await authenticateApiToken(token) || (localDevelopmentAllowed() ? publicGuestAuth() : null);

  if (!auth) {
    return NextResponse.json(
      {
        error: {
          message: "Incorrect API key provided. Provide an authorization header with format 'Bearer sc_live_...'.",
          type: "invalid_request_error",
          param: null,
          code: "invalid_api_key",
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
        error: {
          message: "Malformed JSON in request body.",
          type: "invalid_request_error",
          param: null,
          code: "bad_json",
        },
      },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const { model = "sales-coach", messages = [], stream = false } = body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      {
        error: {
          message: "'messages' array is required and must not be empty.",
          type: "invalid_request_error",
          param: "messages",
          code: "missing_required_parameter",
        },
      },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // Find the latest user message
  const userMessages = messages.filter((m: any) => m && m.role === "user");
  const lastUserMessage = userMessages[userMessages.length - 1];
  const query = typeof lastUserMessage?.content === "string"
    ? lastUserMessage.content.trim()
    : Array.isArray(lastUserMessage?.content)
    ? lastUserMessage.content.map((c: any) => c.text || "").join(" ").trim()
    : "";

  if (!query) {
    return NextResponse.json(
      {
        error: {
          message: "No user message content found in messages.",
          type: "invalid_request_error",
          param: "messages",
          code: "empty_content",
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

    const completionId = `chatcmpl-${randomUUID()}`;
    const created = Math.floor(Date.now() / 1000);
    const content = result.text;

    // Handle Streaming (SSE)
    if (stream) {
      const encoder = new TextEncoder();
      const sseStream = new ReadableStream({
        start(controller) {
          // Initial role chunk
          const roleChunk = {
            id: completionId,
            object: "chat.completion.chunk",
            created,
            model,
            choices: [
              {
                index: 0,
                delta: { role: "assistant", content: "" },
                finish_reason: null,
              },
            ],
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(roleChunk)}\n\n`));

          // Content chunk
          const contentChunk = {
            id: completionId,
            object: "chat.completion.chunk",
            created,
            model,
            choices: [
              {
                index: 0,
                delta: { content },
                finish_reason: null,
              },
            ],
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(contentChunk)}\n\n`));

          // Final stop chunk
          const finishChunk = {
            id: completionId,
            object: "chat.completion.chunk",
            created,
            model,
            choices: [
              {
                index: 0,
                delta: {},
                finish_reason: "stop",
              },
            ],
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(finishChunk)}\n\n`));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });

      return new Response(sseStream, {
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // Standard Non-Streaming JSON Response
    const promptTokens = Math.max(1, Math.ceil(query.length / 4));
    const completionTokens = Math.max(1, Math.ceil(content.length / 4));

    return NextResponse.json(
      {
        id: completionId,
        object: "chat.completion",
        created,
        model,
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content,
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: promptTokens + completionTokens,
        },
      },
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        error: {
          message: err.message || "Failed to process chat completion.",
          type: "api_error",
          param: null,
          code: "internal_error",
        },
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export const dynamic = "force-dynamic";

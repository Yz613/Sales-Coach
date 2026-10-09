import { withWorkspaceApi } from "@/lib/workspace";
import { NextResponse } from "next/server";
import { pingProvider } from "@/lib/ai/llm";
import { resolveAiSettings } from "@/lib/ai/settings";
import { getProvider, isProviderId, type ProviderId } from "@/lib/ai/providers";
import { requireWorkspace, workspaceErrorResponse } from "@/lib/workspace";

async function POSTHandler(req: Request) {
  try {
    await requireWorkspace();
    const body = await req.json();
    const incomingKey = (body.apiKey || "").toString().trim();
    const stored = await resolveAiSettings(incomingKey || undefined);
    const usingTypedKey = Boolean(incomingKey);
    const providerId: ProviderId = usingTypedKey && isProviderId(body.provider) ? body.provider : stored.providerId;
    const model = (usingTypedKey && body.model ? String(body.model) : stored.model) || getProvider(providerId).models[0].id;
    const baseUrl = String(body.baseUrl || stored.baseUrl || process.env.LOCAL_OPENAI_BASE_URL || "").trim();
    const apiKey = providerId === "local"
      ? (incomingKey || (stored.providerId === "local" ? stored.apiKey : stored.localApiKey) || "local")
      : (incomingKey || stored.apiKey || "");

    if (providerId === "local" && !baseUrl) {
      return NextResponse.json({
        success: false,
        error: "Set the OpenAI-compatible base URL before testing a local model.",
      }, { status: 400 });
    }

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: `No ${getProvider(providerId).name} API key provided or found.`,
      }, { status: 400 });
    }

    await pingProvider(providerId, apiKey, model, providerId === "local" ? baseUrl : undefined);

    return NextResponse.json({
      success: true,
      message: `API key verified with ${getProvider(providerId).name} (${model}).`,
      provider: providerId,
      model,
    });
  } catch (err: any) {
    const gated = workspaceErrorResponse(err);
    if (gated.status !== 500) return gated;
    return NextResponse.json({
      success: false,
      error: "The provider rejected the request. Check the key, model, and provider permissions.",
    }, { status: 400 });
  }
}

export const POST = withWorkspaceApi(POSTHandler, { admin: true });

export const dynamic = "force-dynamic";

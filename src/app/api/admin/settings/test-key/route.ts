import { NextResponse } from "next/server";
import { pingProvider } from "@/lib/ai/llm";
import { resolveAiSettings } from "@/lib/ai/settings";
import { getProvider, isProviderId, type ProviderId } from "@/lib/ai/providers";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const stored = await resolveAiSettings(body.apiKey);
    const providerId: ProviderId = isProviderId(body.provider) ? body.provider : stored.providerId;
    const model = (body.model || stored.model || getProvider(providerId).models[0].id) as string;
    const apiKey = (body.apiKey || stored.apiKey || "").trim();

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: `No ${getProvider(providerId).name} API key provided or found.`,
      }, { status: 400 });
    }

    await pingProvider(providerId, apiKey, model);

    return NextResponse.json({
      success: true,
      message: `API key verified with ${getProvider(providerId).name} (${model}).`,
      provider: providerId,
      model,
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message || "Failed to verify API key",
    }, { status: 400 });
  }
}

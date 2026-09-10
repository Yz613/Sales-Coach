import { NextResponse } from "next/server";
import { setSetting } from "@/lib/db/service";
import { resolveAiSettings } from "@/lib/ai/settings";
import { getTranscriptionStatus } from "@/lib/ai/transcribe";
import {
  AI_PROVIDERS,
  defaultModelForProvider,
  detectProviderFromKey,
  getProvider,
  isProviderId,
  type ProviderId,
} from "@/lib/ai/providers";

export async function GET() {
  try {
    const ai = await resolveAiSettings();
    const transcription = await getTranscriptionStatus();

    return NextResponse.json({
      hasKey: ai.hasKey,
      maskedKey: ai.maskedKey,
      provider: ai.providerId,
      activeModel: ai.model,
      providers: AI_PROVIDERS,
      canTranscribe: transcription.canTranscribe,
      transcribeReason: transcription.reason || null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    let providerId: ProviderId | undefined;
    if (body.provider !== undefined && isProviderId(body.provider)) {
      providerId = body.provider;
      await setSetting("ai_provider", body.provider);
    }

    const incomingKey = (body.apiKey ?? body.geminiApiKey ?? "").toString();
    if (incomingKey.trim().length > 0) {
      const key = incomingKey.trim();
      await setSetting("ai_api_key", key);
      const detected = detectProviderFromKey(key);
      if (!providerId && detected) {
        providerId = detected;
        await setSetting("ai_provider", detected);
      }
    }

    if (body.activeModel !== undefined && String(body.activeModel).trim()) {
      await setSetting("active_model", String(body.activeModel).trim());
    } else if (providerId) {
      const current = (await resolveAiSettings()).model;
      const belongs = getProvider(providerId).models.some((m) => m.id === current);
      if (!belongs) {
        await setSetting("active_model", defaultModelForProvider(providerId));
      }
    }

    return NextResponse.json({ success: true, message: "Settings saved successfully." });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

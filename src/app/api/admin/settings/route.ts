import { NextResponse } from "next/server";
import { getSetting, setSetting } from "@/lib/db/service";
import { modelForProvider, resolveAiSettings } from "@/lib/ai/settings";
import { getTranscriptionStatus } from "@/lib/ai/transcribe";
import {
  AI_PROVIDERS,
  detectProviderFromKey,
  isProviderId,
  type ProviderId,
} from "@/lib/ai/providers";
import { maskSecret } from "@/lib/inviteMail";
import { loadBillingAccount, saveBillingSettings, summarizeBilling } from "@/lib/billingQuota";
import { requireWorkspace, workspaceErrorResponse } from "@/lib/workspace";

export async function GET() {
  try {
    const auth = await requireWorkspace();
    const ai = await resolveAiSettings();
    const transcription = await getTranscriptionStatus();
    const resendKey = (await getSetting("resend_api_key"))?.trim() || "";
    const envResend = Boolean(process.env.RESEND_API_KEY?.trim());
    const billing = summarizeBilling(await loadBillingAccount(auth));

    return NextResponse.json({
      hasKey: ai.hasKey,
      maskedKey: ai.maskedKey,
      provider: ai.providerId,
      activeModel: ai.model,
      providerCorrected: Boolean(ai.providerCorrected),
      providers: AI_PROVIDERS,
      canTranscribe: transcription.canTranscribe,
      transcribeReason: transcription.reason || null,
      hasResendKey: Boolean(resendKey) || envResend,
      maskedResendKey: resendKey ? maskSecret(resendKey) : envResend ? "env RESEND_API_KEY" : "",
      resendFromEnv: envResend,
      billing,
    });
  } catch (err: any) {
    const gated = workspaceErrorResponse(err);
    if (gated.status !== 500) return gated;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireWorkspace();
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
      if (detected && detected !== providerId) {
        providerId = detected;
        await setSetting("ai_provider", detected);
      }
    }

    if (body.resendApiKey !== undefined) {
      const key = String(body.resendApiKey || "").trim();
      if (key) await setSetting("resend_api_key", key);
    }

    if (body.activeModel !== undefined && String(body.activeModel).trim()) {
      const requested = String(body.activeModel).trim();
      await setSetting("active_model", providerId ? modelForProvider(providerId, requested) : requested);
    } else if (providerId) {
      const current = (await resolveAiSettings()).model;
      await setSetting("active_model", modelForProvider(providerId, current));
    }

    if (body.overageOptIn !== undefined) {
      await saveBillingSettings(auth, {
        overageOptIn: typeof body.overageOptIn === "boolean" ? body.overageOptIn : undefined,
      });
    }

    return NextResponse.json({ success: true, message: "Settings saved successfully." });
  } catch (err: any) {
    const gated = workspaceErrorResponse(err);
    if (gated.status !== 500) return gated;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

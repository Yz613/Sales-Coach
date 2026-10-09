import { withWorkspaceApi } from "@/lib/workspace";
import { NextResponse } from "next/server";
import { getSetting, setSetting } from "@/lib/db/service";
import { LocalModelUrlError, normalizeOpenAiBaseUrl, privateModelUrlsAllowed } from "@/lib/ai/localEndpoint";
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
import { emailCaptureSettings, saveEmailCaptureSettings } from "@/lib/integrations/email";
import { RevenueError } from "@/lib/revenue/security";

async function GETHandler() {
  try {
    const auth = await requireWorkspace();
    const ai = await resolveAiSettings();
    const transcription = await getTranscriptionStatus();
    const resendKey = (await getSetting("resend_api_key"))?.trim() || "";
    const envResend = Boolean(process.env.RESEND_API_KEY?.trim());
    const billing = summarizeBilling(await loadBillingAccount(auth));
    const emailCapture = await emailCaptureSettings();

    return NextResponse.json({
      hasKey: ai.hasKey,
      maskedKey: ai.maskedKey,
      provider: ai.providerId,
      activeModel: ai.model,
      baseUrl: ai.baseUrl || "",
      whisperBaseUrl: ai.whisperBaseUrl || "",
      providerCorrected: Boolean(ai.providerCorrected),
      providers: AI_PROVIDERS,
      canTranscribe: transcription.canTranscribe,
      transcribeReason: transcription.reason || null,
      hasResendKey: Boolean(resendKey) || envResend,
      maskedResendKey: resendKey ? maskSecret(resendKey) : envResend ? "env RESEND_API_KEY" : "",
      resendFromEnv: envResend,
      billing,
      emailCapture,
    });
  } catch (err: any) {
    const gated = workspaceErrorResponse(err);
    if (gated.status !== 500) return gated;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function POSTHandler(req: Request) {
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
      if (providerId !== "local") {
        const detected = detectProviderFromKey(key);
        if (detected && detected !== providerId) {
          providerId = detected;
          await setSetting("ai_provider", detected);
        }
      }
    }

    if (body.baseUrl !== undefined) {
      await setSetting("local_base_url", storedLocalUrl(body.baseUrl));
    }
    if (body.whisperBaseUrl !== undefined) {
      await setSetting("local_whisper_base_url", storedLocalUrl(body.whisperBaseUrl));
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

    if (body.emailCaptureEnabled !== undefined || body.emailExcludedDomains !== undefined) {
      await saveEmailCaptureSettings({ enabled: body.emailCaptureEnabled, domains: body.emailExcludedDomains });
    }

    if (body.overageOptIn !== undefined) {
      await saveBillingSettings(auth, {
        overageOptIn: typeof body.overageOptIn === "boolean" ? body.overageOptIn : undefined,
      });
    }

    return NextResponse.json({ success: true, message: "Settings saved successfully." });
  } catch (err: any) {
    if (err instanceof LocalModelUrlError) return NextResponse.json({ error: err.message }, { status: 400 });
    if (err instanceof RevenueError) return NextResponse.json({ error: err.message }, { status: err.status });
    const gated = workspaceErrorResponse(err);
    if (gated.status !== 500) return gated;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function storedLocalUrl(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return normalizeOpenAiBaseUrl(raw, { allowPrivate: privateModelUrlsAllowed() });
}

export const GET = withWorkspaceApi(GETHandler, { admin: true });
export const POST = withWorkspaceApi(POSTHandler, { admin: true });

export const dynamic = "force-dynamic";

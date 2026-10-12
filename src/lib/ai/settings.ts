import { getAllSettings, getSetting } from "../db/service";
import { LocalModelUrlError, normalizeOpenAiBaseUrl, privateModelUrlsAllowed } from "./localEndpoint";
import {
  AI_PROVIDERS,
  DEFAULT_PROVIDER,
  defaultModelForProvider,
  detectProviderFromKey,
  getModel,
  getProvider,
  isProviderId,
  type ProviderId,
} from "./providers";

export interface ResolvedAiSettings {
  providerId: ProviderId;
  model: string;
  apiKey: string | null;
  hasKey: boolean;
  maskedKey: string;
  /** OpenAI-compatible base, without /chat/completions. Set for the local provider. */
  baseUrl: string | null;
  /** Optional Whisper-compatible base, without /audio/transcriptions. */
  whisperBaseUrl: string | null;
  /** Bearer saved for the local server. Never a hosted provider key. */
  localApiKey: string | null;
  /** True when the stored key prefix does not match the saved provider. */
  providerCorrected?: boolean;
}

function maskKey(key: string): string {
  if (key.length < 12) return `${key.slice(0, 3)}••••`;
  return `${key.slice(0, 6)}••••••••${key.slice(-4)}`;
}

function envKeyFor(providerId: ProviderId, env: Record<string, string | undefined>): string | null {
  const envName = getProvider(providerId).envKey;
  return env[envName] || null;
}

function firstEnvKey(env: Record<string, string | undefined>): { providerId: ProviderId; apiKey: string } | null {
  for (const provider of AI_PROVIDERS) {
    const value = env[provider.envKey];
    if (value && value.trim()) return { providerId: provider.id, apiKey: value.trim() };
  }
  return null;
}

export function modelForProvider(providerId: ProviderId, requestedModel?: string | null): string {
  const requested = (requestedModel || "").trim();
  if (!requested) return defaultModelForProvider(providerId);
  if (getModel(providerId, requested)) return requested;
  if (getProvider(providerId).allowsCustomModel) return requested;
  return defaultModelForProvider(providerId);
}

/**
 * Pick the provider that can actually use this key.
 * A Gemini key selected as OpenAI (or the reverse) used to call the wrong API,
 * fail, and silently fall back to the built-in rule engine.
 */
export function providerForKey(
  apiKey: string,
  requestedProvider?: string | null
): { providerId: ProviderId; corrected: boolean } {
  const requested = isProviderId(requestedProvider || "") ? (requestedProvider as ProviderId) : undefined;
  if (requested === "local") return { providerId: "local", corrected: false };
  const detected = detectProviderFromKey(apiKey);
  if (detected && requested && detected !== requested) {
    return { providerId: detected, corrected: true };
  }
  if (detected) return { providerId: detected, corrected: false };
  if (requested) return { providerId: requested, corrected: false };
  return { providerId: DEFAULT_PROVIDER, corrected: false };
}

export function resolveAiSettingsFrom(
  settings: Record<string, string>,
  env: Record<string, string | undefined> = process.env,
  overrideKey?: string
): ResolvedAiSettings {
  const storedKey = (settings["ai_api_key"] || settings["gemini_api_key"] || "").trim();
  const storedLocalKey = (settings["local_api_key"] || "").trim();
  const requestedProvider = settings["ai_provider"];
  const savedModel = (settings["active_model"] || "").trim();
  const explicitLocal = requestedProvider === "local";
  const localApiKey = (storedLocalKey || (env.LOCAL_OPENAI_API_KEY || "")).trim() || null;

  let providerId: ProviderId = isProviderId(requestedProvider) ? requestedProvider : DEFAULT_PROVIDER;
  // A hosted key must not become the bearer for a local server the admin just selected.
  let apiKey = explicitLocal
    ? (overrideKey || localApiKey || "").trim()
    : (overrideKey || storedKey || envKeyFor(providerId, env) || "").trim();
  let providerCorrected = false;

  if (!apiKey && !explicitLocal) {
    const fallback = firstEnvKey(env);
    if (fallback) {
      providerId = fallback.providerId;
      apiKey = fallback.apiKey;
    } else if ((env.LOCAL_OPENAI_BASE_URL || "").trim()) {
      providerId = "local";
    }
  }

  if (apiKey && !explicitLocal) {
    const matched = providerForKey(apiKey, requestedProvider);
    providerId = matched.providerId;
    providerCorrected = matched.corrected;
  }

  const local = providerId === "local";
  const baseUrl = local ? optionalLocalBase(settings["local_base_url"] || env.LOCAL_OPENAI_BASE_URL || "", env) : null;
  const whisperBaseUrl = optionalLocalBase(settings["local_whisper_base_url"] || env.LOCAL_WHISPER_BASE_URL || "", env);
  if (local && !apiKey && baseUrl) apiKey = (env.LOCAL_OPENAI_API_KEY || "").trim() || "local";
  const envModel = (env.LOCAL_OPENAI_MODEL || "").trim();
  const localPlaceholder = defaultModelForProvider("local");
  const model = local
    ? ((savedModel && savedModel !== localPlaceholder ? savedModel : envModel) || savedModel || localPlaceholder)
    : modelForProvider(providerId, savedModel);

  return {
    providerId,
    model,
    apiKey: apiKey || null,
    hasKey: local ? Boolean(baseUrl) : Boolean(apiKey),
    maskedKey: apiKey && apiKey !== "local" ? maskKey(apiKey) : "",
    baseUrl,
    whisperBaseUrl,
    localApiKey,
    providerCorrected,
  };
}

function optionalLocalBase(raw: string, env: Record<string, string | undefined>): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return normalizeOpenAiBaseUrl(trimmed, { allowPrivate: privateModelUrlsAllowed(env) });
  } catch (err) {
    if (err instanceof LocalModelUrlError) return null;
    throw err;
  }
}

export async function resolveAiSettings(overrideKey?: string): Promise<ResolvedAiSettings> {
  return resolveAiSettingsFrom(await getAllSettings(), process.env, overrideKey);
}

export async function getStoredProvider(): Promise<ProviderId> {
  const value = await getSetting("ai_provider");
  return isProviderId(value || "") ? (value as ProviderId) : DEFAULT_PROVIDER;
}

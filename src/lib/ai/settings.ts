import { getAllSettings, getSetting } from "../db/service";
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
  const requestedProvider = settings["ai_provider"];
  const storedModel = (settings["active_model"] || "").trim();

  let providerId: ProviderId = isProviderId(requestedProvider) ? requestedProvider : DEFAULT_PROVIDER;
  let apiKey = (overrideKey || storedKey || envKeyFor(providerId, env) || "").trim();
  let providerCorrected = false;

  if (!apiKey) {
    const fallback = firstEnvKey(env);
    if (fallback) {
      providerId = fallback.providerId;
      apiKey = fallback.apiKey;
    }
  }

  if (apiKey) {
    const matched = providerForKey(apiKey, requestedProvider);
    providerId = matched.providerId;
    providerCorrected = matched.corrected;
  }

  return {
    providerId,
    model: modelForProvider(providerId, storedModel),
    apiKey: apiKey || null,
    hasKey: Boolean(apiKey),
    maskedKey: apiKey ? maskKey(apiKey) : "",
    providerCorrected,
  };
}

export async function resolveAiSettings(overrideKey?: string): Promise<ResolvedAiSettings> {
  return resolveAiSettingsFrom(await getAllSettings(), process.env, overrideKey);
}

export async function getStoredProvider(): Promise<ProviderId> {
  const value = await getSetting("ai_provider");
  return isProviderId(value || "") ? (value as ProviderId) : DEFAULT_PROVIDER;
}

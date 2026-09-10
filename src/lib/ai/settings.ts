import { getAllSettings, getSetting } from "../db/service";
import {
  AI_PROVIDERS,
  DEFAULT_MODEL,
  DEFAULT_PROVIDER,
  detectProviderFromKey,
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
}

function maskKey(key: string): string {
  if (key.length < 12) return `${key.slice(0, 3)}••••`;
  return `${key.slice(0, 6)}••••••••${key.slice(-4)}`;
}

function envKeyFor(providerId: ProviderId): string | null {
  const envName = getProvider(providerId).envKey;
  return process.env[envName] || null;
}

function firstEnvKey(): { providerId: ProviderId; apiKey: string } | null {
  for (const provider of AI_PROVIDERS) {
    const value = process.env[provider.envKey];
    if (value && value.trim()) return { providerId: provider.id, apiKey: value.trim() };
  }
  return null;
}

export async function resolveAiSettings(overrideKey?: string): Promise<ResolvedAiSettings> {
  const settings = await getAllSettings();
  const storedKey = (settings["ai_api_key"] || settings["gemini_api_key"] || "").trim();
  const requestedProvider = settings["ai_provider"];
  const storedModel = (settings["active_model"] || "").trim() || DEFAULT_MODEL;

  let providerId: ProviderId = isProviderId(requestedProvider) ? requestedProvider : DEFAULT_PROVIDER;
  let apiKey = (overrideKey || storedKey || envKeyFor(providerId) || "").trim();

  if (!apiKey) {
    const fallback = firstEnvKey();
    if (fallback) {
      providerId = fallback.providerId;
      apiKey = fallback.apiKey;
    }
  }

  if (!isProviderId(requestedProvider) && apiKey) {
    const detected = detectProviderFromKey(apiKey);
    if (detected) providerId = detected;
  }

  return {
    providerId,
    model: storedModel,
    apiKey: apiKey || null,
    hasKey: Boolean(apiKey),
    maskedKey: apiKey ? maskKey(apiKey) : "",
  };
}

export async function getStoredProvider(): Promise<ProviderId> {
  const value = await getSetting("ai_provider");
  return isProviderId(value || "") ? (value as ProviderId) : DEFAULT_PROVIDER;
}

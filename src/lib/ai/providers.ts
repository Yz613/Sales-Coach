export type ProviderId = "gemini" | "openai" | "anthropic" | "groq" | "openrouter";

export interface AIModel {
  id: string;
  label: string;
  /** USD per 1M input tokens (list price, approximate). */
  inputPerMTok: number;
  /** USD per 1M output tokens (list price, approximate). */
  outputPerMTok: number;
  note?: string;
}

export interface AIProvider {
  id: ProviderId;
  name: string;
  keyPlaceholder: string;
  keyHint: string;
  envKey: string;
  models: AIModel[];
  allowsCustomModel?: boolean;
}

export const DEFAULT_PROVIDER: ProviderId = "gemini";
export const DEFAULT_MODEL = "gemini-3.8-flash";

export const AI_PROVIDERS: AIProvider[] = [
  {
    id: "gemini",
    name: "Google Gemini",
    keyPlaceholder: "AIzaSy...",
    keyHint: "Google AI Studio / Gemini API key",
    envKey: "GEMINI_API_KEY",
    models: [
      { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash", inputPerMTok: 0.5, outputPerMTok: 3.0, note: "Recommended — strongest Flash" },
      { id: "gemini-3.7-flash", label: "Gemini 3.7 Flash", inputPerMTok: 0.4, outputPerMTok: 2.5, note: "Fast agentic reasoning" },
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", inputPerMTok: 0.3, outputPerMTok: 2.5, note: "Legacy, low latency" },
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", inputPerMTok: 1.25, outputPerMTok: 10.0, note: "Deeper reasoning, higher cost" },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    keyPlaceholder: "sk-...",
    keyHint: "OpenAI API key",
    envKey: "OPENAI_API_KEY",
    models: [
      { id: "gpt-4o-mini", label: "GPT-4o mini", inputPerMTok: 0.15, outputPerMTok: 0.6, note: "Cheapest solid reviewer" },
      { id: "gpt-4.1-mini", label: "GPT-4.1 mini", inputPerMTok: 0.4, outputPerMTok: 1.6, note: "Strong, inexpensive" },
      { id: "gpt-4o", label: "GPT-4o", inputPerMTok: 2.5, outputPerMTok: 10.0, note: "High quality coaching" },
      { id: "gpt-4.1", label: "GPT-4.1", inputPerMTok: 2.0, outputPerMTok: 8.0, note: "Long-context reasoning" },
      { id: "o4-mini", label: "o4-mini", inputPerMTok: 1.1, outputPerMTok: 4.4, note: "Reasoning model" },
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    keyPlaceholder: "sk-ant-...",
    keyHint: "Anthropic Claude API key",
    envKey: "ANTHROPIC_API_KEY",
    models: [
      { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", inputPerMTok: 1.0, outputPerMTok: 5.0, note: "Fast and inexpensive" },
      { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", inputPerMTok: 3.0, outputPerMTok: 15.0, note: "Recommended coach quality" },
      { id: "claude-opus-4-6", label: "Claude Opus 4.6", inputPerMTok: 15.0, outputPerMTok: 75.0, note: "Highest cost, deepest critique" },
    ],
  },
  {
    id: "groq",
    name: "Groq",
    keyPlaceholder: "gsk_...",
    keyHint: "Groq Cloud API key",
    envKey: "GROQ_API_KEY",
    models: [
      { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B", inputPerMTok: 0.59, outputPerMTok: 0.79, note: "Very fast, low cost" },
      { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant", inputPerMTok: 0.05, outputPerMTok: 0.08, note: "Ultra-cheap fallback" },
      { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B", inputPerMTok: 0.15, outputPerMTok: 0.6, note: "Open-weight on Groq" },
    ],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    keyPlaceholder: "sk-or-...",
    keyHint: "OpenRouter key — route any hosted model",
    envKey: "OPENROUTER_API_KEY",
    allowsCustomModel: true,
    models: [
      { id: "openai/gpt-4o-mini", label: "OpenAI GPT-4o mini", inputPerMTok: 0.15, outputPerMTok: 0.6 },
      { id: "anthropic/claude-sonnet-4.5", label: "Claude Sonnet 4.5", inputPerMTok: 3.0, outputPerMTok: 15.0 },
      { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", inputPerMTok: 0.3, outputPerMTok: 2.5 },
      { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B", inputPerMTok: 0.12, outputPerMTok: 0.3 },
    ],
  },
];

export function getProvider(id: string | null | undefined): AIProvider {
  return AI_PROVIDERS.find((p) => p.id === id) || AI_PROVIDERS[0];
}

export function getModel(providerId: string | null | undefined, modelId: string | null | undefined): AIModel | undefined {
  const provider = getProvider(providerId);
  return provider.models.find((m) => m.id === modelId);
}

export function detectProviderFromKey(apiKey: string): ProviderId | null {
  const key = apiKey.trim();
  if (!key) return null;
  if (key.startsWith("sk-ant-")) return "anthropic";
  if (key.startsWith("gsk_")) return "groq";
  if (key.startsWith("sk-or-") || key.startsWith("or-")) return "openrouter";
  if (key.startsWith("AIza") || key.startsWith("AI")) return "gemini";
  if (key.startsWith("sk-")) return "openai";
  return null;
}

export function isProviderId(value: string): value is ProviderId {
  return AI_PROVIDERS.some((p) => p.id === value);
}

/** Typical call-review token usage used for the settings cost preview. */
export const TYPICAL_REVIEW_INPUT_TOKENS = 8000;
export const TYPICAL_REVIEW_OUTPUT_TOKENS = 2500;

export function estimateCostUsd(
  model: Pick<AIModel, "inputPerMTok" | "outputPerMTok">,
  inputTokens = TYPICAL_REVIEW_INPUT_TOKENS,
  outputTokens = TYPICAL_REVIEW_OUTPUT_TOKENS
): number {
  return (inputTokens / 1_000_000) * model.inputPerMTok + (outputTokens / 1_000_000) * model.outputPerMTok;
}

export function formatUsd(amount: number): string {
  if (amount === 0) return "$0";
  if (amount < 0.01) return `$${amount.toFixed(4)}`;
  return `$${amount.toFixed(2)}`;
}

export function defaultModelForProvider(providerId: ProviderId): string {
  return getProvider(providerId).models[0].id;
}

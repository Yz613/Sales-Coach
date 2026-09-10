import { DEFAULT_MODEL } from "./providers";

export type GeminiThinkingLevel = "low" | "medium" | "high";

export function isGemini3Model(model: string | null | undefined): boolean {
  const id = (model || "").trim();
  return /^gemini-3(?:\.|$|-)/i.test(id) || /\/gemini-3(?:\.|$|-)/i.test(id);
}

export function geminiTextFromResponse(data: any): string {
  return (data?.candidates?.[0]?.content?.parts || [])
    .filter((part: any) => typeof part?.text === "string" && part.text && !part.thought)
    .map((part: any) => part.text)
    .join("\n")
    .trim();
}

export function geminiGenerationConfig(
  model: string,
  opts: {
    responseMimeType?: string;
    thinkingLevel?: GeminiThinkingLevel;
    temperature?: number;
  } = {}
): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  if (opts.responseMimeType) {
    config.responseMimeType = opts.responseMimeType;
  }
  if (isGemini3Model(model)) {
    config.thinkingConfig = {
      thinkingLevel: opts.thinkingLevel || "low",
    };
  } else if (typeof opts.temperature === "number") {
    config.temperature = opts.temperature;
  }
  return config;
}

/** Use the saved model only — do not silently fall back to retired 2.5 IDs. */
export function geminiModelsToTry(selected?: string | null): string[] {
  const chosen = (selected || "").trim();
  return [chosen || DEFAULT_MODEL];
}

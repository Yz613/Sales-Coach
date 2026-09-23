import { DEFAULT_MODEL } from "./providers";

export type GeminiThinkingLevel = "low" | "medium" | "high";

export function isGemini3Model(model: string | null | undefined): boolean {
  const id = (model || "").trim();
  return /^gemini-3(?:\.|$|-)/i.test(id) || /\/gemini-3(?:\.|$|-)/i.test(id);
}

export function geminiTextFromResponse(data: any): string {
  const parts = (data?.candidates?.[0]?.content?.parts || [])
    .filter((part: any) => typeof part?.text === "string" && part.text && !part.thought)
    .map((part: any) => part.text as string);
  if (!parts.length) return "";
  // JSON is often split across parts. A newline join injects a character the
  // model did not emit and can land inside a string, which JSON.parse rejects.
  const concatenated = parts.join("").trim();
  if (concatenated.startsWith("{") || concatenated.startsWith("[")) return concatenated;
  return parts.join("\n").trim();
}

export type GeminiSchemaMode = "full" | "jsonSchema" | "responseFormat" | "mimeOnly";

export function geminiGenerationConfig(
  model: string,
  opts: {
    responseMimeType?: string;
    responseSchema?: Record<string, unknown>;
    /** Which schema fields to attach. `full` sends both current Gemini shapes. */
    schemaMode?: GeminiSchemaMode;
    thinkingLevel?: GeminiThinkingLevel;
    temperature?: number;
    maxOutputTokens?: number;
  } = {}
): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  if (opts.responseMimeType) {
    config.responseMimeType = opts.responseMimeType;
  }
  if (typeof opts.maxOutputTokens === "number") {
    config.maxOutputTokens = opts.maxOutputTokens;
  }
  const mode = opts.schemaMode || "full";
  if (opts.responseSchema && mode !== "mimeOnly") {
    config.responseMimeType = opts.responseMimeType || "application/json";
    if (mode === "full" || mode === "jsonSchema") {
      config.responseJsonSchema = opts.responseSchema;
    }
    if (mode === "full" || mode === "responseFormat") {
      config.responseFormat = {
        text: {
          mimeType: "application/json",
          schema: opts.responseSchema,
        },
      };
    }
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

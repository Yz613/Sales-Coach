import { validateModelOutput } from "./output-validation";
import { EVIDENCE_POLICY } from "./evidence";
import { geminiGenerationConfig, geminiTextFromResponse, type GeminiSchemaMode } from "./gemini";
import { extractJson } from "./json";
import { openAiChatCompletionsUrl, privateModelUrlsAllowed } from "./localEndpoint";
import { estimateCostUsd, getModel, getProvider, type ProviderId } from "./providers";

// Credentialed requests use manual redirects: supported by Workers, with no key forwarding.

export interface LlmJsonResult {
  parsed: any;
  rawText: string;
  usage?: { inputTokens: number; outputTokens: number };
  estimatedCostUsd?: number;
}

function geminiSchemaRejected(status: number, message: string): boolean {
  if (status !== 400) return false;
  return /responseFormat|responseJsonSchema|responseSchema|Unknown name|Invalid JSON payload|schema/i.test(message);
}

function nextSchemaMode(mode: GeminiSchemaMode, message: string): GeminiSchemaMode | undefined {
  const mentionsFormat = /responseFormat/i.test(message);
  const mentionsJson = /responseJsonSchema|responseSchema/i.test(message);
  if (/invalid schema|too many states|schema is too|unsupported/i.test(message)) return "mimeOnly";
  if (mode === "full") {
    if (mentionsFormat && !mentionsJson) return "jsonSchema";
    if (mentionsJson && !mentionsFormat) return "responseFormat";
    return "jsonSchema";
  }
  if (mode === "jsonSchema") return mentionsJson ? "responseFormat" : "mimeOnly";
  if (mode === "responseFormat") return "mimeOnly";
  return undefined;
}

async function callGemini(
  apiKey: string,
  model: string,
  prompt: string,
  responseSchema?: Record<string, unknown>
): Promise<{ text: string; usage?: LlmJsonResult["usage"]; finishReason?: string }> {
  let mode: GeminiSchemaMode = responseSchema ? "full" : "mimeOnly";
  let data: any;
  let res: Response | undefined;
  for (let attempt = 0; attempt < 4; attempt++) {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST", redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(90000),
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: EVIDENCE_POLICY }] },
          contents: [{ parts: [{ text: prompt }] }],
          // Disables request logging even when the Google Cloud project has logging on.
          store: false,
          generationConfig: geminiGenerationConfig(model, {
            responseMimeType: "application/json",
            responseSchema,
            schemaMode: mode,
            thinkingLevel: "low",
            maxOutputTokens: 16384,
          }),
        }),
      }
    );
    try {
      data = await res.json();
    } catch {
      throw new Error(`Gemini request failed (${res.status})`);
    }
    if (res.ok && !data.error) break;
    const message: string = String(data?.error?.message || `Gemini request failed (${res.status})`);
    const downgrade: GeminiSchemaMode | undefined = responseSchema ? nextSchemaMode(mode, message) : undefined;
    if (!geminiSchemaRejected(res.status, message) || !downgrade || downgrade === mode) {
      throw new Error(`Gemini request failed (${res.status}). Check the provider configuration.`);
    }
    mode = downgrade;
  }
  if (!res || !data || data.error) {
    throw new Error(`Gemini request failed (${res?.status || 0}).`);
  }
  const text = geminiTextFromResponse(data);
  const finishReason = String(data?.candidates?.[0]?.finishReason || "");
  if (!text) {
    throw new Error(
      finishReason && finishReason !== "STOP"
        ? `Gemini returned no JSON (finishReason: ${finishReason})`
        : "Empty model response"
    );
  }
  const usage = data?.usageMetadata
    ? {
        inputTokens: Number(data.usageMetadata.promptTokenCount || 0),
        outputTokens: Number(data.usageMetadata.candidatesTokenCount || 0),
      }
    : undefined;
  return { text, usage, finishReason };
}

class OpenAiFormatError extends Error {}

async function callOpenAiCompatible(
  url: string,
  apiKey: string,
  model: string,
  prompt: string,
  extraHeaders: Record<string, string> = {},
  extraBody: Record<string, unknown> = {},
  jsonObject = true
): Promise<{ text: string; usage?: LlmJsonResult["usage"] }> {
  const res = await fetch(url, {
    method: "POST", redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(90000),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: `You are a sales coach. Return only valid JSON that matches the requested schema. ${EVIDENCE_POLICY}` },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      ...(jsonObject ? { response_format: { type: "json_object" } } : {}),
      ...extraBody,
    }),
  });
  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Provider request failed (${res.status}). Check the provider configuration.`);
  }
  if (!res.ok || data?.error) {
    const detail = JSON.stringify(data?.error || data || "");
    if (jsonObject && res.status === 400 && /response_format|json_object|json_schema/i.test(detail)) {
      throw new OpenAiFormatError(detail);
    }
    throw new Error(`Provider request failed (${res.status}). Check the provider configuration.`);
  }
  const text = data?.choices?.[0]?.message?.content || "";
  const usage = data?.usage
    ? {
        inputTokens: Number(data.usage.prompt_tokens || 0),
        outputTokens: Number(data.usage.completion_tokens || 0),
      }
    : undefined;
  return { text, usage };
}

async function callAnthropic(apiKey: string, model: string, prompt: string): Promise<{ text: string; usage?: LlmJsonResult["usage"] }> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(90000),
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      system: `You are a sales coach. Return only valid JSON that matches the requested schema. ${EVIDENCE_POLICY}`,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Anthropic request failed (${res.status}). Check the provider configuration.`);
  }
  if (!res.ok || data?.error) {
    throw new Error(`Anthropic request failed (${res.status}). Check the provider configuration.`);
  }
  const text = (data?.content || [])
    .filter((part: any) => part.type === "text")
    .map((part: any) => part.text)
    .join("\n");
  const usage = data?.usage
    ? {
        inputTokens: Number(data.usage.input_tokens || 0),
        outputTokens: Number(data.usage.output_tokens || 0),
      }
    : undefined;
  return { text, usage };
}

export async function pingProvider(
  providerId: ProviderId,
  apiKey: string,
  model: string,
  baseUrl?: string | null
): Promise<void> {
  const prompt = 'Respond with JSON: {"ok":true}';
  await completeJson({ providerId, apiKey, model, prompt, baseUrl });
}

export async function completeJson(opts: {
  providerId: ProviderId;
  apiKey: string;
  model: string;
  prompt: string;
  responseSchema?: Record<string, unknown>;
  /** OpenAI-compatible base URL. Required for the local provider unless LOCAL_OPENAI_BASE_URL is set. */
  baseUrl?: string | null;
}): Promise<LlmJsonResult> {
  const { providerId, apiKey, model, prompt, responseSchema } = opts;
  const baseUrl = opts.baseUrl || (providerId === "local" ? process.env.LOCAL_OPENAI_BASE_URL : undefined);
  let text = "";
  let usage: LlmJsonResult["usage"];
  let finishReason: string | undefined;

  if (providerId === "gemini") {
    ({ text, usage, finishReason } = await callGemini(apiKey, model, prompt, responseSchema));
  } else if (providerId === "anthropic") {
    ({ text, usage } = await callAnthropic(apiKey, model, prompt));
  } else if (providerId === "openai") {
    ({ text, usage } = await callOpenAiCompatible(
      "https://api.openai.com/v1/chat/completions",
      apiKey,
      model,
      prompt,
      {},
      { store: false }
    ));
  } else if (providerId === "groq") {
    ({ text, usage } = await callOpenAiCompatible(
      "https://api.groq.com/openai/v1/chat/completions",
      apiKey,
      model,
      prompt,
      {},
      { store: false }
    ));
  } else if (providerId === "openrouter") {
    // Default is "allow", which routes to providers that may store prompts and train on them.
    ({ text, usage } = await callOpenAiCompatible(
      "https://openrouter.ai/api/v1/chat/completions",
      apiKey,
      model,
      prompt,
      {
        "HTTP-Referer": process.env.APP_URL || "https://github.com/Yz613/Sales-Coach",
        "X-Title": "Sales Coach",
      },
      { provider: { data_collection: "deny" } }
    ));
  } else if (providerId === "local") {
    if (!baseUrl) {
      throw new Error("Set an OpenAI-compatible base URL before scoring with a local model.");
    }
    const endpoint = openAiChatCompletionsUrl(baseUrl, { allowPrivate: privateModelUrlsAllowed() });
    try {
      ({ text, usage } = await callOpenAiCompatible(endpoint, apiKey || "local", model, prompt));
    } catch (err) {
      if (!(err instanceof OpenAiFormatError)) throw err;
      ({ text, usage } = await callOpenAiCompatible(endpoint, apiKey || "local", model, prompt, {}, {}, false));
    }
  } else {
    throw new Error(`Unsupported provider: ${providerId}`);
  }

  let parsed: any;
  try {
    parsed = extractJson(text);
  } catch (err) {
    const parseMessage = err instanceof Error ? err.message : String(err);
    if (finishReason === "MAX_TOKENS") {
      throw new Error("Gemini output was truncated before the JSON was complete");
    }
    throw new Error(parseMessage);
  }
  validateModelOutput(parsed, responseSchema);
  const catalogModel = getModel(providerId, model) || { inputPerMTok: 0, outputPerMTok: 0 };
  const estimatedCostUsd = usage
    ? estimateCostUsd(catalogModel, usage.inputTokens, usage.outputTokens)
    : undefined;

  return { parsed, rawText: text, usage, estimatedCostUsd };
}

export function providerDisplayName(providerId: string): string {
  return getProvider(providerId).name;
}

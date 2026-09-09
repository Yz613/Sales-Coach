import { estimateCostUsd, getModel, getProvider, type ProviderId } from "./providers";

export interface LlmJsonResult {
  parsed: any;
  rawText: string;
  usage?: { inputTokens: number; outputTokens: number };
  estimatedCostUsd?: number;
}

function extractJson(text: string): any {
  const trimmed = (text || "").trim();
  if (!trimmed) throw new Error("Empty model response");
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) return JSON.parse(fenced[1].trim());
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error("Model did not return valid JSON");
  }
}

async function callGemini(apiKey: string, model: string, prompt: string): Promise<{ text: string; usage?: LlmJsonResult["usage"] }> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    }
  );
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error?.message || `Gemini request failed (${res.status})`);
  }
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const usage = data?.usageMetadata
    ? {
        inputTokens: Number(data.usageMetadata.promptTokenCount || 0),
        outputTokens: Number(data.usageMetadata.candidatesTokenCount || 0),
      }
    : undefined;
  return { text, usage };
}

async function callOpenAiCompatible(
  url: string,
  apiKey: string,
  model: string,
  prompt: string,
  extraHeaders: Record<string, string> = {}
): Promise<{ text: string; usage?: LlmJsonResult["usage"] }> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "You are a sales coach. Return only valid JSON that matches the requested schema." },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error?.message || `Provider request failed (${res.status})`);
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
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      system: "You are a sales coach. Return only valid JSON that matches the requested schema.",
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error?.message || `Anthropic request failed (${res.status})`);
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

export async function pingProvider(providerId: ProviderId, apiKey: string, model: string): Promise<void> {
  const prompt = 'Respond with JSON: {"ok":true}';
  await completeJson({ providerId, apiKey, model, prompt });
}

export async function completeJson(opts: {
  providerId: ProviderId;
  apiKey: string;
  model: string;
  prompt: string;
}): Promise<LlmJsonResult> {
  const { providerId, apiKey, model, prompt } = opts;
  let text = "";
  let usage: LlmJsonResult["usage"];

  if (providerId === "gemini") {
    ({ text, usage } = await callGemini(apiKey, model, prompt));
  } else if (providerId === "anthropic") {
    ({ text, usage } = await callAnthropic(apiKey, model, prompt));
  } else if (providerId === "openai") {
    ({ text, usage } = await callOpenAiCompatible("https://api.openai.com/v1/chat/completions", apiKey, model, prompt));
  } else if (providerId === "groq") {
    ({ text, usage } = await callOpenAiCompatible("https://api.groq.com/openai/v1/chat/completions", apiKey, model, prompt));
  } else if (providerId === "openrouter") {
    ({ text, usage } = await callOpenAiCompatible("https://openrouter.ai/api/v1/chat/completions", apiKey, model, prompt, {
      "HTTP-Referer": "https://refreshqueue.com",
      "X-Title": "Sales Coach",
    }));
  } else {
    throw new Error(`Unsupported provider: ${providerId}`);
  }

  const parsed = extractJson(text);
  const catalogModel = getModel(providerId, model) || { inputPerMTok: 0, outputPerMTok: 0 };
  const estimatedCostUsd = usage
    ? estimateCostUsd(catalogModel, usage.inputTokens, usage.outputTokens)
    : undefined;

  return { parsed, rawText: text, usage, estimatedCostUsd };
}

export function providerDisplayName(providerId: string): string {
  return getProvider(providerId).name;
}

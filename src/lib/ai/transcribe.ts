import {
  AUDIO_CHUNK_TARGET_BYTES,
  INLINE_AUDIO_BYTES,
  MAX_AUDIO_UPLOAD_BYTES,
  WHISPER_MAX_BYTES,
  canChunkAudio,
  chunkAudio,
  durationFromTranscript,
  estimateAudioDurationSeconds,
  formatClock,
  mergeChunkTranscripts,
  mimeTypeForAudio,
  type AudioChunk,
} from "../audio";
import { detectProviderFromKey, type ProviderId } from "./providers";
import { resolveAiSettings } from "./settings";

export type TranscriptionKind = "gemini" | "openai" | "groq";

export interface TranscriptionBackend {
  kind: TranscriptionKind;
  apiKey: string;
  model?: string;
}

export interface TranscribeAudioInput {
  bytes: Uint8Array;
  fileName: string;
  mimeType?: string;
}

export interface TranscribeAudioResult {
  transcriptText: string;
  durationSeconds: number;
  backend: TranscriptionKind;
  chunkCount: number;
}

const GEMINI_TRANSCRIBE_MODELS = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"];

const TRANSCRIBE_PROMPT = `Transcribe this sales-call audio verbatim.

Rules:
- One utterance per line.
- Prefix every line with an absolute clock time from the start of THIS audio clip: [m:ss] or [h:mm:ss].
- Label speakers. Use names if they introduce themselves; otherwise use Rep and Prospect.
- Do not summarize, coach, or omit talk. Include fillers only when they change meaning.
- Return only the transcript lines, no markdown fences or commentary.`;

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function whisperSegmentsToTranscript(
  segments: Array<{ start?: number; text?: string }>,
  offsetSeconds = 0
): string {
  return segments
    .map((segment) => {
      const text = (segment.text || "").replace(/\s+/g, " ").trim();
      if (!text) return "";
      return `[${formatClock((segment.start || 0) + offsetSeconds)}] ${text}`;
    })
    .filter(Boolean)
    .join("\n");
}

export function cleanModelTranscript(raw: string): string {
  let text = (raw || "").trim();
  if (!text) return "";
  const fenced = text.match(/```(?:[a-zA-Z]+)?\s*([\s\S]*?)```/);
  if (fenced) text = fenced[1].trim();
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !/^here is the transcript/i.test(line))
    .join("\n")
    .trim();
}

function geminiErrorMessage(data: any, status: number): string {
  return data?.error?.message || `Gemini transcription failed (${status})`;
}

async function callGeminiGenerate(
  apiKey: string,
  model: string,
  parts: unknown[]
): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: 0.1 },
      }),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(geminiErrorMessage(data, res.status));
  }
  const text = (data?.candidates?.[0]?.content?.parts || [])
    .map((part: any) => part.text || "")
    .join("\n");
  const cleaned = cleanModelTranscript(text);
  if (!cleaned) {
    throw new Error("Gemini returned an empty transcript for this audio chunk");
  }
  return cleaned;
}

async function transcribeGeminiInline(
  backend: TranscriptionBackend,
  chunk: AudioChunk,
  chunkIndex: number,
  chunkCount: number
): Promise<string> {
  const prompt = chunkCount > 1
    ? `${TRANSCRIBE_PROMPT}\n\nThis is clip ${chunkIndex + 1} of ${chunkCount}. Timestamps should start at 0:00 for this clip (they will be shifted later).`
    : TRANSCRIBE_PROMPT;
  const parts = [
    { inlineData: { mimeType: chunk.mimeType, data: bytesToBase64(chunk.bytes) } },
    { text: prompt },
  ];

  const models = [backend.model, ...GEMINI_TRANSCRIBE_MODELS].filter(
    (model, index, all): model is string => Boolean(model) && all.indexOf(model) === index
  );

  let lastError: Error | null = null;
  for (const model of models) {
    try {
      return await callGeminiGenerate(backend.apiKey, model, parts);
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const message = lastError.message.toLowerCase();
      if (message.includes("not found") || message.includes("unsupported") || message.includes("audio")) {
        continue;
      }
      throw lastError;
    }
  }
  throw lastError || new Error("Gemini could not transcribe this audio");
}

async function uploadGeminiFile(
  apiKey: string,
  bytes: Uint8Array,
  mimeType: string,
  displayName: string
): Promise<{ uri: string; mimeType: string; name: string }> {
  const start = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(bytes.byteLength),
        "X-Goog-Upload-Header-Content-Type": mimeType,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ file: { display_name: displayName } }),
    }
  );
  if (!start.ok) {
    const data = await start.json().catch(() => ({}));
    throw new Error(geminiErrorMessage(data, start.status));
  }
  const uploadUrl = start.headers.get("x-goog-upload-url") || start.headers.get("X-Goog-Upload-URL");
  if (!uploadUrl) {
    throw new Error("Gemini file upload did not return an upload URL");
  }

  const uploaded = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(bytes.byteLength),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: toArrayBuffer(bytes),
  });
  const payload = await uploaded.json().catch(() => ({}));
  if (!uploaded.ok || payload.error) {
    throw new Error(geminiErrorMessage(payload, uploaded.status));
  }

  let file = payload.file || payload;
  for (let attempt = 0; attempt < 12 && file?.state && file.state !== "ACTIVE"; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const poll = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${file.name}?key=${encodeURIComponent(apiKey)}`
    );
    const next = await poll.json().catch(() => ({}));
    file = next.file || next;
  }
  if (!file?.uri) {
    throw new Error("Gemini file upload did not become ready for transcription");
  }
  return { uri: file.uri, mimeType: file.mimeType || mimeType, name: file.name };
}

async function transcribeGeminiFile(
  backend: TranscriptionBackend,
  bytes: Uint8Array,
  mimeType: string,
  fileName: string
): Promise<string> {
  const uploaded = await uploadGeminiFile(backend.apiKey, bytes, mimeType, fileName);
  const parts = [
    { fileData: { mimeType: uploaded.mimeType, fileUri: uploaded.uri } },
    { text: TRANSCRIBE_PROMPT },
  ];
  const models = [backend.model, ...GEMINI_TRANSCRIBE_MODELS].filter(
    (model, index, all): model is string => Boolean(model) && all.indexOf(model) === index
  );
  try {
    let lastError: Error | null = null;
    for (const model of models) {
      try {
        return await callGeminiGenerate(backend.apiKey, model, parts);
      } catch (err: any) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }
    throw lastError || new Error("Gemini could not transcribe the uploaded audio file");
  } finally {
    if (uploaded.name) {
      await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${uploaded.name}?key=${encodeURIComponent(backend.apiKey)}`,
        { method: "DELETE" }
      ).catch(() => undefined);
    }
  }
}

async function transcribeWhisper(
  backend: TranscriptionBackend,
  chunk: AudioChunk,
  fileName: string
): Promise<string> {
  if (chunk.bytes.byteLength > WHISPER_MAX_BYTES) {
    throw new Error(
      `${fileName} is too large for ${backend.kind === "groq" ? "Groq" : "OpenAI"} Whisper. Convert it to MP3/WAV so it can be split, or use a Gemini key.`
    );
  }
  const endpoint = backend.kind === "groq"
    ? "https://api.groq.com/openai/v1/audio/transcriptions"
    : "https://api.openai.com/v1/audio/transcriptions";
  const model = backend.kind === "groq" ? "whisper-large-v3" : "whisper-1";
  const form = new FormData();
  const file = new File([toArrayBuffer(chunk.bytes)], fileName || `chunk.${chunk.mimeType.includes("wav") ? "wav" : "mp3"}`, {
    type: chunk.mimeType,
  });
  form.append("file", file);
  form.append("model", model);
  form.append("response_format", "verbose_json");

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${backend.apiKey}` },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(data.error?.message || `${backend.kind} transcription failed (${res.status})`);
  }
  if (Array.isArray(data.segments) && data.segments.length) {
    return whisperSegmentsToTranscript(data.segments);
  }
  const text = cleanModelTranscript(data.text || "");
  if (!text) {
    throw new Error(`${backend.kind} returned an empty transcript`);
  }
  return text;
}

function isTranscribeCapable(id: ProviderId | null | undefined): id is TranscriptionKind {
  return id === "gemini" || id === "openai" || id === "groq";
}

export async function getTranscriptionStatus(): Promise<{
  canTranscribe: boolean;
  provider?: TranscriptionKind;
  reason?: string;
}> {
  try {
    const backend = await resolveTranscriptionBackend();
    return { canTranscribe: true, provider: backend.kind };
  } catch (err: any) {
    return {
      canTranscribe: false,
      reason: err?.message || "Audio transcription is not configured.",
    };
  }
}

export async function resolveTranscriptionBackend(): Promise<TranscriptionBackend> {
  const ai = await resolveAiSettings();
  if (ai.apiKey && isTranscribeCapable(ai.providerId)) {
    return {
      kind: ai.providerId,
      apiKey: ai.apiKey,
      model: ai.providerId === "gemini" ? ai.model : undefined,
    };
  }

  const envOrder: Array<{ kind: TranscriptionKind; env: string; model?: string }> = [
    { kind: "gemini", env: "GEMINI_API_KEY", model: "gemini-2.5-flash" },
    { kind: "openai", env: "OPENAI_API_KEY" },
    { kind: "groq", env: "GROQ_API_KEY" },
  ];
  for (const candidate of envOrder) {
    const value = (process.env[candidate.env] || "").trim();
    if (value) {
      return { kind: candidate.kind, apiKey: value, model: candidate.model };
    }
  }

  if (ai.apiKey) {
    const detected = detectProviderFromKey(ai.apiKey);
    if (isTranscribeCapable(detected)) {
      return { kind: detected, apiKey: ai.apiKey, model: detected === "gemini" ? ai.model : undefined };
    }
  }

  throw new Error(
    "Audio transcription needs a Gemini, OpenAI, or Groq API key. Add one in Admin → Settings, then re-upload the recording."
  );
}

async function transcribeOneChunk(
  backend: TranscriptionBackend,
  chunk: AudioChunk,
  fileName: string,
  chunkIndex: number,
  chunkCount: number
): Promise<string> {
  if (backend.kind === "gemini") {
    if (chunk.bytes.byteLength <= INLINE_AUDIO_BYTES) {
      return transcribeGeminiInline(backend, chunk, chunkIndex, chunkCount);
    }
    return transcribeGeminiFile(backend, chunk.bytes, chunk.mimeType, `${fileName}.part${chunkIndex + 1}`);
  }
  return transcribeWhisper(backend, chunk, `${fileName.replace(/\.[^/.]+$/, "")}-part${chunkIndex + 1}.mp3`);
}

export async function transcribeAudio(
  input: TranscribeAudioInput,
  backend?: TranscriptionBackend
): Promise<TranscribeAudioResult> {
  const resolved = backend || await resolveTranscriptionBackend();
  const mimeType = mimeTypeForAudio({ name: input.fileName, type: input.mimeType });
  const bytes = input.bytes instanceof Uint8Array ? input.bytes : new Uint8Array(input.bytes);

  if (!bytes.byteLength) {
    throw new Error(`The audio file ${input.fileName || "(unnamed)"} is empty`);
  }
  if (bytes.byteLength > MAX_AUDIO_UPLOAD_BYTES) {
    throw new Error(
      `${input.fileName} is ${(bytes.byteLength / (1024 * 1024)).toFixed(1)} MB. Upload files under 40 MB, or split the recording.`
    );
  }

  const headerDuration = estimateAudioDurationSeconds(bytes, mimeType, input.fileName);
  const shouldSplit = canChunkAudio(mimeType, input.fileName)
    && (bytes.byteLength > AUDIO_CHUNK_TARGET_BYTES || headerDuration > 95);
  const needsGeminiFile = resolved.kind === "gemini"
    && !canChunkAudio(mimeType, input.fileName)
    && bytes.byteLength > INLINE_AUDIO_BYTES;
  const tooBigForWhisper = (resolved.kind === "openai" || resolved.kind === "groq")
    && bytes.byteLength > WHISPER_MAX_BYTES
    && !canChunkAudio(mimeType, input.fileName);

  if (tooBigForWhisper) {
    throw new Error(
      `${input.fileName} is too large for Whisper as a single ${mimeType} file. Convert it to MP3 or WAV so it can be broken into clips, or add a Gemini key.`
    );
  }

  let transcriptText = "";
  let chunkCount = 1;

  if (needsGeminiFile) {
    transcriptText = await transcribeGeminiFile(resolved, bytes, mimeType, input.fileName);
  } else {
    const chunks = shouldSplit ? chunkAudio(bytes, mimeType, input.fileName) : [{
      bytes,
      mimeType,
      offsetSeconds: 0,
      durationSeconds: headerDuration,
    }];
    chunkCount = chunks.length;
    const parts: Array<{ text: string; offsetSeconds: number }> = [];
    for (let i = 0; i < chunks.length; i += 1) {
      const text = await transcribeOneChunk(resolved, chunks[i], input.fileName, i, chunks.length);
      parts.push({ text, offsetSeconds: chunks[i].offsetSeconds });
    }
    transcriptText = mergeChunkTranscripts(parts);
  }

  if (!transcriptText.trim()) {
    throw new Error(`No speech could be transcribed from ${input.fileName}`);
  }

  const durationSeconds = Math.max(headerDuration, durationFromTranscript(transcriptText));
  return {
    transcriptText,
    durationSeconds: Math.round(durationSeconds) || 0,
    backend: resolved.kind,
    chunkCount,
  };
}

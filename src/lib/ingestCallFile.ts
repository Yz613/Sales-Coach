import { durationFromTranscript, estimateAudioDurationSeconds, isAudioFile, mimeTypeForAudio } from "./audio";
import { transcribeAudio } from "./ai/transcribe";

export interface IngestedCallFile {
  transcriptText: string;
  durationSeconds: number;
  source: "audio" | "text";
  audioBytes?: Uint8Array;
  audioMimeType?: string;
  audioFileName?: string;
}

function decodeUtf8(bytes: Uint8Array): string {
  const raw = new TextDecoder("utf-8").decode(bytes);
  return raw.replace(/^\uFEFF/, "");
}

function formatJsonUtterances(items: any[]): string {
  return items
    .map((item) => {
      const text = (item.text || item.transcript || item.content || "").toString().trim();
      if (!text) return "";
      const speaker = (item.speaker || item.speaker_name || item.name || "Speaker").toString().trim();
      const start = Number(item.start ?? item.start_time ?? item.startTime ?? item.offset ?? 0);
      const secs = Number.isFinite(start) ? Math.max(0, start > 1000 ? Math.round(start / 1000) : Math.round(start)) : 0;
      const mm = Math.floor(secs / 60);
      const ss = String(secs % 60).padStart(2, "0");
      return `[${mm}:${ss}] ${speaker}: ${text}`;
    })
    .filter(Boolean)
    .join("\n");
}

export function extractTranscriptFromJson(parsed: unknown): string | null {
  if (!parsed) return null;
  if (typeof parsed === "string" && parsed.trim()) return parsed.trim();
  if (typeof parsed !== "object") return null;
  const obj = parsed as Record<string, any>;

  if (typeof obj.transcript === "string" && obj.transcript.trim()) return obj.transcript.trim();
  if (typeof obj.text === "string" && obj.text.trim() && !Array.isArray(obj.segments)) return obj.text.trim();

  const arrays = [obj.utterances, obj.segments, obj.monologues, obj.phrases, obj.sentences];
  for (const list of arrays) {
    if (Array.isArray(list) && list.length) {
      const formatted = formatJsonUtterances(list);
      if (formatted) return formatted;
    }
  }

  if (Array.isArray(obj.speakers)) {
    const lines = obj.speakers.flatMap((speaker: any) => {
      const name = speaker.name || speaker.speaker || "Speaker";
      const words = Array.isArray(speaker.words) ? speaker.words : [];
      if (typeof speaker.transcript === "string") {
        return [{ speaker: name, text: speaker.transcript, start: speaker.start || 0 }];
      }
      return words.map((word: any) => ({ ...word, speaker: name }));
    });
    const formatted = formatJsonUtterances(lines);
    if (formatted) return formatted;
  }

  return null;
}

export function decodeTranscriptFile(bytes: Uint8Array, fileName: string): string {
  const text = decodeUtf8(bytes).trim();
  if (!text) {
    throw new Error(`${fileName || "Uploaded file"} is empty`);
  }
  if (fileName.toLowerCase().endsWith(".json") || text.startsWith("{") || text.startsWith("[")) {
    try {
      const extracted = extractTranscriptFromJson(JSON.parse(text));
      if (extracted) return extracted;
    } catch {
      // Fall through to raw text when JSON is malformed.
    }
  }
  return text;
}

export interface PeekedCallFile {
  bytes: Uint8Array;
  fileName: string;
  mimeType: string;
  isAudio: boolean;
  durationSeconds: number;
  transcriptText?: string;
}

/** Read the file and estimate duration without starting transcription. */
export async function peekCallFile(file: File): Promise<PeekedCallFile> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const fileName = file.name;
  const mimeType = mimeTypeForAudio(file);
  if (isAudioFile(file)) {
    return {
      bytes,
      fileName,
      mimeType,
      isAudio: true,
      durationSeconds: estimateAudioDurationSeconds(bytes, mimeType, fileName),
    };
  }
  const transcriptText = decodeTranscriptFile(bytes, fileName);
  return {
    bytes,
    fileName,
    mimeType: file.type || "text/plain",
    isAudio: false,
    durationSeconds: durationFromTranscript(transcriptText),
    transcriptText,
  };
}

export async function ingestPeekedCallFile(peek: PeekedCallFile): Promise<IngestedCallFile> {
  if (peek.isAudio) {
    const result = await transcribeAudio({
      bytes: peek.bytes,
      fileName: peek.fileName,
      mimeType: peek.mimeType,
    });
    return {
      transcriptText: result.transcriptText,
      durationSeconds: Math.max(peek.durationSeconds, result.durationSeconds),
      source: "audio",
      audioBytes: peek.bytes,
      audioMimeType: peek.mimeType,
      audioFileName: peek.fileName,
    };
  }

  const transcriptText = peek.transcriptText ?? decodeTranscriptFile(peek.bytes, peek.fileName);
  return {
    transcriptText,
    durationSeconds: peek.durationSeconds || durationFromTranscript(transcriptText),
    source: "text",
  };
}

export async function ingestCallFile(file: File): Promise<IngestedCallFile> {
  return ingestPeekedCallFile(await peekCallFile(file));
}

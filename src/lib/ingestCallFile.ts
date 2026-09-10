import { durationFromTranscript, isAudioFile } from "./audio";
import { transcribeAudio } from "./ai/transcribe";

export interface IngestedCallFile {
  transcriptText: string;
  durationSeconds: number;
  source: "audio" | "text";
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

export async function ingestCallFile(file: File): Promise<IngestedCallFile> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (isAudioFile(file)) {
    const result = await transcribeAudio({
      bytes,
      fileName: file.name,
      mimeType: file.type,
    });
    return {
      transcriptText: result.transcriptText,
      durationSeconds: result.durationSeconds,
      source: "audio",
    };
  }

  const transcriptText = decodeTranscriptFile(bytes, file.name);
  return {
    transcriptText,
    durationSeconds: durationFromTranscript(transcriptText),
    source: "text",
  };
}

import { formatDuration } from "./utils";

export interface TranscriptTurn {
  index: number;
  speaker: string;
  text: string;
  timestamp: string;
  timestampSeconds: number;
  charOffset: number;
}

const TIMESTAMP_RE =
  /^(?:\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]|\((\d{1,2}):(\d{2})(?::(\d{2}))?\)|(\d{1,2}):(\d{2})(?::(\d{2}))?)\s*[-–—:]?\s*/;

function parseClock(hOrM: string, mOrS: string, maybeS?: string): number {
  if (maybeS !== undefined && maybeS !== "") {
    return Number(hOrM) * 3600 + Number(mOrS) * 60 + Number(maybeS);
  }
  return Number(hOrM) * 60 + Number(mOrS);
}

export function parseLeadingTimestamp(line: string): { seconds: number; rest: string } | null {
  const match = line.match(TIMESTAMP_RE);
  if (!match) return null;
  const seconds = match[1] != null
    ? parseClock(match[1], match[2], match[3])
    : match[4] != null
      ? parseClock(match[4], match[5], match[6])
      : parseClock(match[7], match[8], match[9]);
  return { seconds, rest: line.slice(match[0].length) };
}

function splitSpeaker(line: string): { speaker: string; text: string } {
  const colon = line.match(/^([A-Za-z][A-Za-z0-9 .'-]{0,40}):\s*(.*)$/);
  if (colon && colon[2].trim()) {
    return { speaker: colon[1].trim(), text: colon[2].trim() };
  }
  return { speaker: "Unknown", text: line.trim() };
}

function estimateSeconds(charOffset: number, totalChars: number, durationSeconds: number): number {
  if (totalChars <= 0 || durationSeconds <= 0) return 0;
  return Math.max(0, Math.min(durationSeconds, Math.round((charOffset / totalChars) * durationSeconds)));
}

/** Split a transcript into speaker turns with clock times (parsed or estimated). */
export function parseTranscript(transcriptText: string, durationSeconds = 0): TranscriptTurn[] {
  const raw = (transcriptText || "").replace(/\r\n/g, "\n").trim();
  if (!raw) return [];

  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  const totalChars = lines.reduce((sum, l) => sum + l.length, 0) || 1;
  let offset = 0;
  let lastSeconds = 0;
  const turns: TranscriptTurn[] = [];

  lines.forEach((line, index) => {
    const stamped = parseLeadingTimestamp(line);
    const body = stamped ? stamped.rest : line;
    const { speaker, text } = splitSpeaker(body);
    const seconds = stamped
      ? stamped.seconds
      : estimateSeconds(offset, totalChars, durationSeconds);
    const clamped = Math.max(lastSeconds, seconds);
    lastSeconds = clamped;
    turns.push({
      index,
      speaker,
      text,
      timestamp: formatDuration(clamped),
      timestampSeconds: clamped,
      charOffset: offset,
    });
    offset += line.length + 1;
  });

  return turns;
}

const MISSING_TRANSCRIPT_RE =
  /automatic transcription is not configured|audio file ingested|paste the transcript for a full evaluation|no (usable )?transcript|no speech could be transcribed|transcription (is )?(not |un)available|there('s| is) no transcription/i;

function looksLikeBinaryGarbage(text: string): boolean {
  const sample = text.slice(0, 2000);
  let bad = 0;
  for (let i = 0; i < sample.length; i += 1) {
    const code = sample.charCodeAt(i);
    if (code === 0 || code === 0xfffd || code < 9 || (code > 13 && code < 32)) bad += 1;
  }
  return bad >= 20;
}

/** True when the stored text is a stub, empty, or binary — not a real call dialogue. */
export function isUnusableTranscript(text: string | null | undefined): boolean {
  const raw = (text || "").trim();
  if (!raw) return true;
  if (MISSING_TRANSCRIPT_RE.test(raw)) return true;
  if (looksLikeBinaryGarbage(raw)) return true;
  return false;
}

export function requireUsableTranscript(text: string | null | undefined): string {
  const raw = (text || "").trim();
  if (isUnusableTranscript(raw)) {
    throw new Error(
      "This upload has no usable transcript, so coaching was not started and no tokens were used. Paste the dialogue, or add a Gemini, OpenAI, or Groq key in Admin → Settings before uploading audio."
    );
  }
  return raw;
}

export function normalizeForSearch(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

/** Find the turn that best matches a quote (exact, then fuzzy). */
export function findTurnForQuote(turns: TranscriptTurn[], quote: string): TranscriptTurn | undefined {
  const needle = (quote || "").trim();
  if (!needle || turns.length === 0) return undefined;

  const exact = turns.find((t) => t.text.includes(needle) || needle.includes(t.text));
  if (exact) return exact;

  const normNeedle = normalizeForSearch(needle);
  if (!normNeedle) return undefined;

  const snippet = normNeedle.slice(0, 48);
  const fuzzy = turns.find((t) => {
    const hay = normalizeForSearch(t.text);
    return hay.includes(snippet) || snippet.includes(hay.slice(0, 48));
  });
  if (fuzzy) return fuzzy;

  const words = normNeedle.split(" ").filter((w) => w.length > 3);
  if (words.length < 2) return undefined;
  let best: TranscriptTurn | undefined;
  let bestHits = 0;
  for (const turn of turns) {
    const hay = normalizeForSearch(turn.text);
    const hits = words.filter((w) => hay.includes(w)).length;
    if (hits > bestHits && hits >= Math.min(3, words.length)) {
      bestHits = hits;
      best = turn;
    }
  }
  return best;
}

export function citeFromTurn(turn: TranscriptTurn | undefined, fallbackQuote = ""): {
  timestamp: string;
  timestampSeconds: number;
  quote: string;
} | undefined {
  if (!turn && !fallbackQuote) return undefined;
  return {
    timestamp: turn?.timestamp || "",
    timestampSeconds: turn?.timestampSeconds ?? 0,
    quote: (turn?.text || fallbackQuote).slice(0, 280),
  };
}

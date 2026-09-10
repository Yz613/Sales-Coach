import { formatDuration } from "./utils";
import { parseLeadingTimestamp } from "./transcript";

export const AUDIO_EXTENSIONS = [
  ".mp3",
  ".wav",
  ".wave",
  ".m4a",
  ".aac",
  ".ogg",
  ".oga",
  ".webm",
  ".flac",
  ".mp4",
  ".mpeg",
  ".mpga",
] as const;

export const MAX_AUDIO_UPLOAD_BYTES = 40 * 1024 * 1024;
export const INLINE_AUDIO_BYTES = 12 * 1024 * 1024;
export const WHISPER_MAX_BYTES = 24 * 1024 * 1024;
export const AUDIO_CHUNK_TARGET_BYTES = 2 * 1024 * 1024;
export const AUDIO_CHUNK_TARGET_SECONDS = 90;

const AUDIO_MIME_BY_EXT: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".wave": "audio/wav",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".oga": "audio/ogg",
  ".webm": "audio/webm",
  ".flac": "audio/flac",
  ".mp4": "audio/mp4",
  ".mpeg": "audio/mpeg",
  ".mpga": "audio/mpeg",
};

export interface AudioFileLike {
  name?: string;
  type?: string | null;
}

export interface AudioChunk {
  bytes: Uint8Array;
  mimeType: string;
  offsetSeconds: number;
  durationSeconds: number;
}

const MPEG1_L3_BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
const MPEG2_L3_BITRATES = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];
const MPEG1_RATES = [44100, 48000, 32000, 0];
const MPEG2_RATES = [22050, 24000, 16000, 0];

export function fileExtension(name: string | undefined | null): string {
  const base = (name || "").split("?")[0].split("#")[0];
  const dot = base.lastIndexOf(".");
  return dot >= 0 ? base.slice(dot).toLowerCase() : "";
}

export function mimeTypeForAudio(file: AudioFileLike): string {
  const type = (file.type || "").trim().toLowerCase();
  if (type.startsWith("audio/") || type === "video/mp4" || type === "video/webm") {
    return type === "audio/mp3" ? "audio/mpeg" : type;
  }
  return AUDIO_MIME_BY_EXT[fileExtension(file.name)] || "application/octet-stream";
}

export function isAudioFile(file: AudioFileLike | null | undefined): boolean {
  if (!file) return false;
  const type = (file.type || "").toLowerCase();
  if (type.startsWith("audio/")) return true;
  return AUDIO_EXTENSIONS.includes(fileExtension(file.name) as (typeof AUDIO_EXTENSIONS)[number]);
}

export function canChunkAudio(mimeType: string, fileName?: string): boolean {
  const mime = (mimeType || "").toLowerCase();
  const ext = fileExtension(fileName);
  return mime.includes("wav") || mime === "audio/wave" || mime === "audio/x-wav"
    || mime === "audio/mpeg" || mime === "audio/mp3"
    || ext === ".wav" || ext === ".wave" || ext === ".mp3" || ext === ".mpeg" || ext === ".mpga";
}

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  return formatDuration(safe);
}

export function durationFromTranscript(text: string): number {
  const lines = (text || "").replace(/\r\n/g, "\n").split("\n");
  let max = 0;
  for (const line of lines) {
    const stamped = parseLeadingTimestamp(line.trim());
    if (stamped && stamped.seconds > max) max = stamped.seconds;
  }
  return max;
}

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function readU32le(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
}

function writeU32le(view: Uint8Array, offset: number, value: number) {
  view[offset] = value & 0xff;
  view[offset + 1] = (value >> 8) & 0xff;
  view[offset + 2] = (value >> 16) & 0xff;
  view[offset + 3] = (value >> 24) & 0xff;
}

export interface WavInfo {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  dataOffset: number;
  dataSize: number;
  durationSeconds: number;
  bytesPerSecond: number;
}

export function parseWav(bytes: Uint8Array): WavInfo | null {
  if (bytes.length < 44) return null;
  if (readAscii(bytes, 0, 4) !== "RIFF" || readAscii(bytes, 8, 4) !== "WAVE") return null;

  let offset = 12;
  let sampleRate = 0;
  let channels = 0;
  let bitsPerSample = 0;
  let dataOffset = -1;
  let dataSize = 0;

  while (offset + 8 <= bytes.length) {
    const id = readAscii(bytes, offset, 4);
    const size = readU32le(bytes, offset + 4);
    const start = offset + 8;
    if (id === "fmt " && size >= 16 && start + 16 <= bytes.length) {
      channels = bytes[start + 2] | (bytes[start + 3] << 8);
      sampleRate = readU32le(bytes, start + 4);
      bitsPerSample = bytes[start + 14] | (bytes[start + 15] << 8);
    } else if (id === "data") {
      dataOffset = start;
      dataSize = Math.min(size, bytes.length - start);
      break;
    }
    offset = start + size + (size % 2);
  }

  if (!sampleRate || !channels || !bitsPerSample || dataOffset < 0) return null;
  const bytesPerSecond = sampleRate * channels * (bitsPerSample / 8);
  if (bytesPerSecond <= 0) return null;
  return {
    sampleRate,
    channels,
    bitsPerSample,
    dataOffset,
    dataSize,
    durationSeconds: dataSize / bytesPerSecond,
    bytesPerSecond,
  };
}

export function buildWavHeader(
  dataSize: number,
  sampleRate: number,
  channels: number,
  bitsPerSample: number
): Uint8Array {
  const header = new Uint8Array(44);
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  header.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
  writeU32le(header, 4, 36 + dataSize);
  header.set([0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20], 8); // WAVEfmt
  writeU32le(header, 16, 16);
  header[20] = 1;
  header[21] = 0;
  header[22] = channels & 0xff;
  header[23] = (channels >> 8) & 0xff;
  writeU32le(header, 24, sampleRate);
  writeU32le(header, 28, byteRate);
  header[32] = blockAlign & 0xff;
  header[33] = (blockAlign >> 8) & 0xff;
  header[34] = bitsPerSample & 0xff;
  header[35] = (bitsPerSample >> 8) & 0xff;
  header.set([0x64, 0x61, 0x74, 0x61], 36); // data
  writeU32le(header, 40, dataSize);
  return header;
}

export interface Mp3FrameInfo {
  offset: number;
  length: number;
  sampleRate: number;
  bitrate: number;
  samples: number;
  durationSeconds: number;
}

export function parseMp3FrameHeader(bytes: Uint8Array, offset: number): Mp3FrameInfo | null {
  if (offset + 4 > bytes.length) return null;
  const b0 = bytes[offset];
  const b1 = bytes[offset + 1];
  const b2 = bytes[offset + 2];
  if (b0 !== 0xff || (b1 & 0xe0) !== 0xe0) return null;

  const versionBits = (b1 >> 3) & 0x03;
  const layerBits = (b1 >> 1) & 0x03;
  if (versionBits === 1 || layerBits === 0) return null;

  const bitrateIndex = (b2 >> 4) & 0x0f;
  const rateIndex = (b2 >> 2) & 0x03;
  const padding = (b2 >> 1) & 0x01;
  if (bitrateIndex === 0 || bitrateIndex === 15 || rateIndex === 3) return null;

  const isMpeg1 = versionBits === 3;
  const isLayer3 = layerBits === 1;
  const bitrateKbps = isMpeg1
    ? MPEG1_L3_BITRATES[bitrateIndex]
    : MPEG2_L3_BITRATES[bitrateIndex];
  const sampleRate = isMpeg1 ? MPEG1_RATES[rateIndex] : MPEG2_RATES[rateIndex];
  if (!bitrateKbps || !sampleRate || !isLayer3) return null;

  const samples = isMpeg1 ? 1152 : 576;
  const coeff = isMpeg1 ? 144 : 72;
  const length = Math.floor((coeff * bitrateKbps * 1000) / sampleRate) + padding;
  if (length < 4 || offset + length > bytes.length) return null;

  return {
    offset,
    length,
    sampleRate,
    bitrate: bitrateKbps * 1000,
    samples,
    durationSeconds: samples / sampleRate,
  };
}

export function iterateMp3Frames(bytes: Uint8Array): Mp3FrameInfo[] {
  const frames: Mp3FrameInfo[] = [];
  let i = 0;
  // Skip ID3v2
  if (bytes.length >= 10 && readAscii(bytes, 0, 3) === "ID3") {
    const size =
      ((bytes[6] & 0x7f) << 21) |
      ((bytes[7] & 0x7f) << 14) |
      ((bytes[8] & 0x7f) << 7) |
      (bytes[9] & 0x7f);
    i = 10 + size;
  }

  while (i + 4 <= bytes.length) {
    const frame = parseMp3FrameHeader(bytes, i);
    if (frame) {
      frames.push(frame);
      i += frame.length;
      continue;
    }
    i += 1;
  }
  return frames;
}

export function estimateAudioDurationSeconds(bytes: Uint8Array, mimeType: string, fileName?: string): number {
  const wav = parseWav(bytes);
  if (wav) return wav.durationSeconds;

  if (canChunkAudio(mimeType, fileName) && (mimeType.includes("mpeg") || fileExtension(fileName) === ".mp3")) {
    const frames = iterateMp3Frames(bytes);
    if (frames.length) {
      return frames.reduce((sum, frame) => sum + frame.durationSeconds, 0);
    }
  }
  return 0;
}

function sliceBytes(bytes: Uint8Array, start: number, end: number): Uint8Array {
  return bytes.subarray(start, end);
}

function chunkWav(bytes: Uint8Array, wav: WavInfo): AudioChunk[] {
  const frameSize = wav.channels * (wav.bitsPerSample / 8);
  const maxBytes = Math.max(frameSize, Math.floor(AUDIO_CHUNK_TARGET_SECONDS * wav.bytesPerSecond));
  const alignedMax = Math.max(frameSize, maxBytes - (maxBytes % frameSize));
  const chunks: AudioChunk[] = [];

  for (let cursor = 0; cursor < wav.dataSize; ) {
    const take = Math.min(alignedMax, wav.dataSize - cursor);
    const alignedTake = take - (take % frameSize);
    if (alignedTake <= 0) break;
    const pcm = sliceBytes(bytes, wav.dataOffset + cursor, wav.dataOffset + cursor + alignedTake);
    const header = buildWavHeader(alignedTake, wav.sampleRate, wav.channels, wav.bitsPerSample);
    const out = new Uint8Array(header.length + pcm.length);
    out.set(header, 0);
    out.set(pcm, header.length);
    chunks.push({
      bytes: out,
      mimeType: "audio/wav",
      offsetSeconds: cursor / wav.bytesPerSecond,
      durationSeconds: alignedTake / wav.bytesPerSecond,
    });
    cursor += alignedTake;
  }
  return chunks.length ? chunks : [{ bytes, mimeType: "audio/wav", offsetSeconds: 0, durationSeconds: wav.durationSeconds }];
}

function chunkMp3(bytes: Uint8Array): AudioChunk[] {
  const frames = iterateMp3Frames(bytes);
  if (!frames.length) {
    return [{ bytes, mimeType: "audio/mpeg", offsetSeconds: 0, durationSeconds: 0 }];
  }

  const chunks: AudioChunk[] = [];
  let start = 0;
  let bytesUsed = 0;
  let secondsUsed = 0;
  let offsetSeconds = 0;

  const flush = (endExclusive: number) => {
    if (endExclusive <= start) return;
    const first = frames[start];
    const last = frames[endExclusive - 1];
    const slice = sliceBytes(bytes, first.offset, last.offset + last.length);
    chunks.push({
      bytes: slice,
      mimeType: "audio/mpeg",
      offsetSeconds,
      durationSeconds: secondsUsed,
    });
    offsetSeconds += secondsUsed;
    start = endExclusive;
    bytesUsed = 0;
    secondsUsed = 0;
  };

  frames.forEach((frame, index) => {
    if (
      index > start &&
      (bytesUsed + frame.length > AUDIO_CHUNK_TARGET_BYTES || secondsUsed + frame.durationSeconds > AUDIO_CHUNK_TARGET_SECONDS)
    ) {
      flush(index);
    }
    bytesUsed += frame.length;
    secondsUsed += frame.durationSeconds;
  });
  flush(frames.length);
  return chunks;
}

export function chunkAudio(bytes: Uint8Array, mimeType: string, fileName?: string): AudioChunk[] {
  const wav = parseWav(bytes);
  if (wav && wav.durationSeconds > AUDIO_CHUNK_TARGET_SECONDS + 1) {
    return chunkWav(bytes, wav);
  }
  if (wav) {
    return [{ bytes, mimeType: "audio/wav", offsetSeconds: 0, durationSeconds: wav.durationSeconds }];
  }

  if (canChunkAudio(mimeType, fileName) && (mimeType.includes("mpeg") || fileExtension(fileName) === ".mp3")) {
    const duration = estimateAudioDurationSeconds(bytes, mimeType, fileName);
    if (bytes.length > AUDIO_CHUNK_TARGET_BYTES || duration > AUDIO_CHUNK_TARGET_SECONDS + 1) {
      return chunkMp3(bytes);
    }
    return [{ bytes, mimeType: "audio/mpeg", offsetSeconds: 0, durationSeconds: duration }];
  }

  return [{
    bytes,
    mimeType: mimeTypeForAudio({ name: fileName, type: mimeType }),
    offsetSeconds: 0,
    durationSeconds: estimateAudioDurationSeconds(bytes, mimeType, fileName),
  }];
}

export function shiftTranscriptTimestamps(text: string, offsetSeconds: number): string {
  if (!offsetSeconds) return text;
  return (text || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => {
      const stamped = parseLeadingTimestamp(line.trim());
      if (!stamped) return line;
      const prefixMatch = line.match(/^(\s*)(\[|\()/);
      const open = prefixMatch?.[2] === "(" ? "(" : "[";
      const close = open === "(" ? ")" : "]";
      return `${open}${formatClock(stamped.seconds + offsetSeconds)}${close} ${stamped.rest}`.trim();
    })
    .join("\n");
}

export function mergeChunkTranscripts(parts: Array<{ text: string; offsetSeconds: number }>): string {
  return parts
    .map((part) => shiftTranscriptTimestamps(part.text.trim(), part.offsetSeconds))
    .filter(Boolean)
    .join("\n")
    .trim();
}

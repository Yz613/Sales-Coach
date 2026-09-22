"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { Headphones, Pause, Play } from "lucide-react";
import { formatDuration, mediaPath } from "@/lib/utils";
import { parseTranscript } from "@/lib/transcript";
import TimestampedTranscript from "@/components/TimestampedTranscript";
import type { TranscriptTurn } from "@/lib/transcript";

function highlightIndex(turns: TranscriptTurn[], currentSeconds?: number): number {
  if (currentSeconds == null) return -1;
  return turns.reduce((found, turn, index) => {
    const next = turns[index + 1];
    if (currentSeconds >= turn.timestampSeconds && (!next || currentSeconds < next.timestampSeconds)) {
      return index;
    }
    return found;
  }, 0);
}

const TranscriptPane = memo(
  function TranscriptPane({
    turns,
    transcriptText,
    durationSeconds,
    currentSeconds,
    onSeek,
  }: {
    turns: TranscriptTurn[];
    transcriptText: string;
    durationSeconds: number;
    currentSeconds?: number;
    onSeek?: (seconds: number) => void;
  }) {
    return (
      <TimestampedTranscript
        transcriptText={transcriptText}
        durationSeconds={durationSeconds}
        currentSeconds={currentSeconds}
        onSeek={onSeek}
        turns={turns}
      />
    );
  },
  (prev, next) =>
    prev.turns === next.turns &&
    prev.transcriptText === next.transcriptText &&
    prev.durationSeconds === next.durationSeconds &&
    prev.onSeek === next.onSeek &&
    highlightIndex(prev.turns, prev.currentSeconds) === highlightIndex(next.turns, next.currentSeconds)
);

export default function CallRecording({
  audioUrl,
  transcriptText,
  durationSeconds,
}: {
  audioUrl?: string;
  transcriptText: string;
  durationSeconds: number;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(durationSeconds || 0);
  const src = audioUrl ? mediaPath(audioUrl) : "";

  const turns = useMemo(
    () => parseTranscript(transcriptText, duration || durationSeconds),
    [transcriptText, duration, durationSeconds]
  );

  const seek = useCallback((seconds: number) => {
    const el = audioRef.current;
    const next = Math.max(0, seconds);
    if (el) el.currentTime = next;
    setCurrent(next);
  }, []);

  const onSeek = useCallback((seconds: number) => {
    seek(seconds);
    audioRef.current?.play().catch(() => undefined);
  }, [seek]);

  useEffect(() => {
    const jumpFromHash = () => {
      const match = window.location.hash.match(/^#t-(\d+)/);
      if (!match) return;
      seek(Number(match[1]));
      audioRef.current?.play().catch(() => undefined);
    };
    jumpFromHash();
    window.addEventListener("hashchange", jumpFromHash);
    return () => window.removeEventListener("hashchange", jumpFromHash);
  }, [src, seek]);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => undefined);
    else el.pause();
  };

  const onBarClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (!duration) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    seek(ratio * duration);
  };

  const progress = duration > 0 ? Math.min(100, (current / duration) * 100) : 0;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/90 overflow-hidden">
      <div className="border-b border-slate-800 px-6 py-4 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sky-400 font-bold text-xs uppercase tracking-wider">
            <Headphones className="h-4 w-4" /> Call recording
          </div>
          <h3 className="text-lg font-bold text-white mt-1">Listen and read the transcript</h3>
        </div>
        {src ? (
          <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[11px] text-slate-300 border border-slate-700">
            {formatDuration(Math.floor(current))} / {formatDuration(Math.floor(duration || durationSeconds))}
          </span>
        ) : null}
      </div>

      {src ? (
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/70 space-y-3">
          <audio
            ref={audioRef}
            src={src}
            preload="metadata"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
            onLoadedMetadata={(event) => {
              if (event.currentTarget.duration && Number.isFinite(event.currentTarget.duration)) {
                setDuration(event.currentTarget.duration);
              }
            }}
            onEnded={() => setPlaying(false)}
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggle}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-500 transition shrink-0"
              aria-label={playing ? "Pause recording" : "Play recording"}
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
            </button>
            <button
              type="button"
              onClick={onBarClick}
              className="relative h-2 flex-1 rounded-full bg-slate-800 overflow-hidden"
              aria-label="Seek in recording"
            >
              <span
                className="absolute inset-y-0 left-0 bg-blue-500"
                style={{ width: `${progress}%` }}
              />
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            Click a timestamp in the transcript — or in the scorecard — to jump to that moment.
          </p>
        </div>
      ) : (
        <div className="px-6 py-3 border-b border-slate-800 bg-slate-950/70">
          <p className="text-xs text-slate-400">
            No recording is stored for this call. The full transcript is below.
          </p>
        </div>
      )}

      <div className="p-6 bg-slate-950">
        <TranscriptPane
          turns={turns}
          transcriptText={transcriptText}
          durationSeconds={duration || durationSeconds}
          currentSeconds={src ? current : undefined}
          onSeek={src ? onSeek : undefined}
        />
      </div>
    </div>
  );
}

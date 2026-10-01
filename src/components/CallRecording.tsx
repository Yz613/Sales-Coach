"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type SyntheticEvent } from "react";
import { Headphones, Pause, Play } from "lucide-react";
import { formatDuration, mediaPath } from "@/lib/utils";
import { parseTranscript } from "@/lib/transcript";
import TimestampedTranscript, { activeTurnIndex } from "@/components/TimestampedTranscript";

export default function CallRecording({
  audioUrl,
  transcriptText,
  durationSeconds,
  mediaKind = "audio",
}: {
  audioUrl?: string;
  transcriptText: string;
  durationSeconds: number;
  mediaKind?: "audio" | "video";
}) {
  const audioRef = useRef<HTMLMediaElement>(null);
  const Media = mediaKind === "video" ? "video" : "audio";
  const progressRef = useRef<HTMLSpanElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const activeIndexRef = useRef(-1);
  const clockLabelRef = useRef("");
  const progressWidthRef = useRef("0%");
  const clipEndRef = useRef<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(durationSeconds || 0);
  const protectedUrl = audioUrl?.replace(/^\/recordings\/(call_0[1-4])\.mp3$/, "/api/calls/$1/audio");
  const src = protectedUrl ? mediaPath(protectedUrl) : "";

  const turns = useMemo(
    () => parseTranscript(transcriptText, duration || durationSeconds),
    [transcriptText, duration, durationSeconds]
  );

  const paintTime = (seconds: number, dur: number) => {
    const width = dur > 0 ? `${Math.min(100, (seconds / dur) * 100)}%` : "0%";
    const label = `${formatDuration(Math.floor(seconds))} / ${formatDuration(Math.floor(dur || durationSeconds))}`;
    progressWidthRef.current = width;
    clockLabelRef.current = label;
    if (progressRef.current) progressRef.current.style.width = width;
    if (clockRef.current && clockRef.current.textContent !== label) clockRef.current.textContent = label;
    const nextIndex = activeTurnIndex(turns, seconds);
    if (nextIndex !== activeIndexRef.current) {
      activeIndexRef.current = nextIndex;
      setActiveIndex(nextIndex);
    }
  };

  useLayoutEffect(() => {
    if (progressRef.current) progressRef.current.style.width = progressWidthRef.current;
    if (clockRef.current) {
      clockRef.current.textContent =
        clockLabelRef.current ||
        `${formatDuration(0)} / ${formatDuration(Math.floor(duration || durationSeconds))}`;
    }
  });

  const seek = (seconds: number) => {
    const el = audioRef.current;
    const next = Math.max(0, seconds);
    if (el) el.currentTime = next;
    paintTime(next, el?.duration && Number.isFinite(el.duration) ? el.duration : duration);
  };

  const onTimeUpdate = (event: SyntheticEvent<HTMLMediaElement>) => {
    const el = event.currentTarget;
    if (clipEndRef.current !== null && el.currentTime >= clipEndRef.current) { el.pause(); clipEndRef.current = null; }
    const dur = el.duration && Number.isFinite(el.duration) ? el.duration : duration;
    paintTime(el.currentTime, dur);
  };

  useEffect(() => {
    const jumpFromHash = () => {
      const match = window.location.hash.match(/^#t-(\d+)(?:-(\d+))?/);
      if (!match) return;
      clipEndRef.current = match[2] ? Number(match[2]) : null;
      seek(Number(match[1]));
      const turn = turns[activeTurnIndex(turns, Number(match[1]))];
      if (turn) requestAnimationFrame(() => document.getElementById(`t-${turn.timestampSeconds}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
      audioRef.current?.play().catch(() => undefined);
    };
    jumpFromHash();
    window.addEventListener("hashchange", jumpFromHash);
    return () => window.removeEventListener("hashchange", jumpFromHash);
  }, [src, turns]);

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

  return (
    <div className="rounded-xl border border-black/[0.08] bg-white overflow-hidden">
      <div className="border-b border-black/[0.08] px-6 py-4 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[#007AFF] font-bold text-xs uppercase tracking-wider">
            <Headphones className="h-4 w-4" /> Call recording
          </div>
          <h3 className="text-lg font-bold text-[#1d1d1f] mt-1">Listen and read the transcript</h3>
        </div>
        {src ? (
          <span
            ref={clockRef}
            className="rounded bg-[#E5E5EA] px-2 py-0.5 font-mono text-[11px] text-[#3a3a3c] border border-black/[0.08]"
          />
        ) : null}
      </div>

      {src ? (
        <div className="px-6 py-4 border-b border-black/[0.08] bg-[#F5F5F7] space-y-3">
          <Media
            ref={el => { audioRef.current = el; }}
            className={mediaKind === "video" ? "w-full rounded-lg bg-black max-h-[480px]" : undefined}
            controls={mediaKind === "video"}
            src={src}
            preload="metadata"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onTimeUpdate={onTimeUpdate}
            onLoadedMetadata={(event) => {
              if (event.currentTarget.duration && Number.isFinite(event.currentTarget.duration)) {
                setDuration(event.currentTarget.duration);
              }
              const stamp = window.location.hash.match(/^#t-(\d+)(?:-(\d+))?/);
              if (stamp) { event.currentTarget.currentTime = Number(stamp[1]); clipEndRef.current = stamp[2] ? Number(stamp[2]) : null; }
            }}
            onEnded={() => setPlaying(false)}
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggle}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#007AFF] text-white hover:bg-[#0071E3] transition shrink-0"
              aria-label={playing ? "Pause recording" : "Play recording"}
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
            </button>
            <button
              type="button"
              onClick={onBarClick}
              className="relative h-2 flex-1 rounded-full bg-[#E5E5EA] overflow-hidden"
              aria-label="Seek in recording"
            >
              <span ref={progressRef} className="absolute inset-y-0 left-0 bg-[#007AFF]" style={{ width: "0%" }} />
            </button>
          </div>
          <p className="text-[11px] text-[#86868b]">
            Click a timestamp in the transcript — or in the scorecard — to jump to that moment.
          </p>
        </div>
      ) : (
        <div className="px-6 py-3 border-b border-black/[0.08] bg-[#F5F5F7]">
          <p className="text-xs text-[#6e6e73]">
            No recording is stored for this call. The full transcript is below.
          </p>
        </div>
      )}

      <div className="p-6 bg-[#F5F5F7]">
        <TimestampedTranscript
          transcriptText={transcriptText}
          durationSeconds={duration || durationSeconds}
          activeIndex={activeIndex}
          onSeek={src ? (seconds) => {
            seek(seconds);
            audioRef.current?.play().catch(() => undefined);
          } : undefined}
          turns={turns}
        />
      </div>
    </div>
  );
}

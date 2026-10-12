"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { Headphones, Pause, Play, RotateCcw } from "lucide-react";
import { formatDuration } from "@/lib/utils";
import { parseTranscript } from "@/lib/transcript";
import TimestampedTranscript, { activeTurnIndex } from "@/components/TimestampedTranscript";

export default function DemoAudioPlayer({
  transcriptText,
  durationSeconds,
  audioUrl,
}: {
  transcriptText: string;
  durationSeconds: number;
  audioUrl?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeIndex, setActiveIndex] = useState(-1);
  const progressRef = useRef<HTMLSpanElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioElemRef = useRef<HTMLAudioElement | null>(null);

  const turns = useMemo(
    () => parseTranscript(transcriptText, durationSeconds),
    [transcriptText, durationSeconds]
  );

  const updateDisplay = (seconds: number) => {
    const clamped = Math.min(durationSeconds, Math.max(0, seconds));
    setCurrentTime(clamped);
    const width = durationSeconds > 0 ? `${(clamped / durationSeconds) * 100}%` : "0%";
    const label = `${formatDuration(Math.floor(clamped))} / ${formatDuration(Math.floor(durationSeconds))}`;
    if (progressRef.current) progressRef.current.style.width = width;
    if (clockRef.current) clockRef.current.textContent = label;
    const nextIdx = activeTurnIndex(turns, clamped);
    setActiveIndex(nextIdx);
  };

  useLayoutEffect(() => {
    updateDisplay(currentTime);
  }, []);

  const seek = (seconds: number) => {
    updateDisplay(seconds);
    if (audioElemRef.current) {
      audioElemRef.current.currentTime = seconds;
    }
  };

  useEffect(() => {
    if (playing) {
      if (audioElemRef.current) {
        audioElemRef.current.play().catch(() => undefined);
      }
      timerRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= durationSeconds) {
            setPlaying(false);
            if (audioElemRef.current) audioElemRef.current.pause();
            return durationSeconds;
          }
          const next = prev + 1;
          const width = `${(next / durationSeconds) * 100}%`;
          const label = `${formatDuration(Math.floor(next))} / ${formatDuration(Math.floor(durationSeconds))}`;
          if (progressRef.current) progressRef.current.style.width = width;
          if (clockRef.current) clockRef.current.textContent = label;
          setActiveIndex(activeTurnIndex(turns, next));
          return next;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioElemRef.current) audioElemRef.current.pause();
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [playing, durationSeconds, turns]);

  useEffect(() => {
    const handleHash = () => {
      const match = window.location.hash.match(/^#t-(\d+)/);
      if (!match) return;
      const targetSeconds = Number(match[1]);
      seek(targetSeconds);
      const turn = turns[activeTurnIndex(turns, targetSeconds)];
      if (turn) {
        requestAnimationFrame(() => {
          document.getElementById(`t-${turn.timestampSeconds}`)?.scrollIntoView({
            block: "nearest",
            behavior: "smooth",
          });
        });
      }
    };
    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, [turns]);

  const toggle = () => {
    if (currentTime >= durationSeconds) {
      seek(0);
    }
    setPlaying((prev) => !prev);
  };

  const handleBarClick = (event: MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    seek(Math.floor(ratio * durationSeconds));
  };

  return (
    <div className="rounded-2xl glass-card overflow-hidden border border-black/[0.08]">
      {audioUrl && (
        <audio
          ref={audioElemRef}
          src={audioUrl}
          preload="none"
          onEnded={() => setPlaying(false)}
        />
      )}
      <div className="border-b border-black/[0.08] px-6 py-4 flex items-center justify-between gap-3 bg-black/[0.02]">
        <div>
          <div className="flex items-center gap-2 text-[#007AFF] font-bold text-xs uppercase tracking-wider">
            <Headphones className="h-4 w-4" /> Interactive Call Recording
          </div>
          <h3 className="text-lg font-bold text-[#1d1d1f] mt-0.5">Listen and track the transcript live</h3>
        </div>
        <span
          ref={clockRef}
          className="rounded-full bg-[#E5E5EA] px-3 py-1 font-mono text-xs font-semibold text-[#3a3a3c] border border-black/[0.08]"
        >
          {formatDuration(0)} / {formatDuration(durationSeconds)}
        </span>
      </div>

      <div className="px-6 py-4 border-b border-black/[0.08] bg-[#F5F5F7] space-y-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggle}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#007AFF] text-white hover:bg-[#0071E3] active:scale-95 transition shadow-sm shrink-0"
            aria-label={playing ? "Pause demo playback" : "Play demo playback"}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
          </button>
          <button
            type="button"
            onClick={() => seek(0)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.05] text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-black/[0.08] transition shrink-0"
            title="Reset playback to start"
            aria-label="Reset playback"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleBarClick}
            className="relative h-2.5 flex-1 rounded-full bg-[#E5E5EA] overflow-hidden cursor-pointer group"
            aria-label="Seek in call recording"
          >
            <span
              ref={progressRef}
              className="absolute inset-y-0 left-0 bg-[#007AFF] transition-all duration-150"
              style={{ width: "0%" }}
            />
          </button>
        </div>
        <p className="text-[11px] text-[#86868b]">
          Press play to stream through the conversation turns live, or click any timestamp in the scorecard or transcript to jump to that moment.
        </p>
      </div>

      <div className="p-6 bg-[#F5F5F7]">
        <TimestampedTranscript
          transcriptText={transcriptText}
          durationSeconds={durationSeconds}
          activeIndex={activeIndex}
          onSeek={(sec) => seek(sec)}
          turns={turns}
        />
      </div>
    </div>
  );
}

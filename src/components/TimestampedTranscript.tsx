"use client";

import { memo, useMemo } from "react";
import { parseTranscript, type TranscriptTurn } from "@/lib/transcript";

export function activeTurnIndex(turns: TranscriptTurn[], currentSeconds: number): number {
  if (!turns.length || currentSeconds < 0) return -1;
  return turns.reduce((found, turn, index) => {
    const next = turns[index + 1];
    if (currentSeconds >= turn.timestampSeconds && (!next || currentSeconds < next.timestampSeconds)) {
      return index;
    }
    return found;
  }, 0);
}

const TranscriptTurnRow = memo(function TranscriptTurnRow({
  turn,
  active,
  onSeek,
}: {
  turn: TranscriptTurn;
  active: boolean;
  onSeek?: (seconds: number) => void;
}) {
  const handleClick = () => {
    if (onSeek) onSeek(turn.timestampSeconds);
  };
  return (
    <div
      id={`t-${turn.timestampSeconds}`}
      className={`scroll-mt-24 flex gap-3.5 p-2 rounded-xl transition-colors ${
        active
          ? "bg-blue-500/15 border border-blue-500/30"
          : "hover:bg-black/[0.04] border border-transparent"
      }`}
    >
      <a
        href={`#t-${turn.timestampSeconds}`}
        onClick={(event) => {
          if (!onSeek) return;
          event.preventDefault();
          handleClick();
        }}
        className="shrink-0 font-mono text-[11px] text-[#007AFF] pt-0.5 w-12 hover:text-[#0071E3] transition-colors font-semibold"
      >
        {turn.timestamp}
      </a>
      <button
        type="button"
        onClick={onSeek ? handleClick : undefined}
        className={`text-left flex-1 ${onSeek ? "cursor-pointer" : "cursor-default"}`}
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6e6e73] bg-black/[0.04] px-2 py-0.5 rounded-full inline-block mb-1 border border-black/[0.06]">
          {turn.speaker}
        </span>
        <p className="text-xs text-[#3a3a3c] leading-relaxed font-normal">{turn.text}</p>
      </button>
    </div>
  );
});

export default function TimestampedTranscript({
  transcriptText,
  durationSeconds,
  activeIndex = -1,
  onSeek,
  turns: providedTurns,
}: {
  transcriptText: string;
  durationSeconds: number;
  activeIndex?: number;
  onSeek?: (seconds: number) => void;
  turns?: TranscriptTurn[];
}) {
  const turns = useMemo(
    () => providedTurns ?? parseTranscript(transcriptText, durationSeconds),
    [providedTurns, transcriptText, durationSeconds]
  );

  if (!turns.length) {
    return (
      <pre className="font-mono text-xs text-[#3a3a3c] leading-relaxed whitespace-pre-wrap max-h-[32rem] overflow-y-auto rounded-2xl glass-inset p-4">
        {transcriptText}
      </pre>
    );
  }

  return (
    <div className="space-y-2 max-h-[32rem] overflow-y-auto pr-1.5 rounded-2xl glass-inset p-3.5">
      {turns.map((turn, index) => (
        <TranscriptTurnRow
          key={`${turn.index}-${turn.timestampSeconds}`}
          turn={turn}
          active={index === activeIndex}
          onSeek={onSeek}
        />
      ))}
    </div>
  );
}

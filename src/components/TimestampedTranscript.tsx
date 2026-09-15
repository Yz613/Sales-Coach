import { parseTranscript, type TranscriptTurn } from "@/lib/transcript";

export default function TimestampedTranscript({
  transcriptText,
  durationSeconds,
  currentSeconds,
  onSeek,
  turns: providedTurns,
}: {
  transcriptText: string;
  durationSeconds: number;
  currentSeconds?: number;
  onSeek?: (seconds: number) => void;
  turns?: TranscriptTurn[];
}) {
  const turns = providedTurns ?? parseTranscript(transcriptText, durationSeconds);

  if (!turns.length) {
    return (
      <pre className="font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap max-h-[32rem] overflow-y-auto rounded-2xl glass-inset p-4">
        {transcriptText}
      </pre>
    );
  }

  const activeIndex =
    currentSeconds == null
      ? -1
      : turns.reduce((found, turn, index) => {
          const next = turns[index + 1];
          if (currentSeconds >= turn.timestampSeconds && (!next || currentSeconds < next.timestampSeconds)) {
            return index;
          }
          return found;
        }, 0);

  return (
    <div className="space-y-2 max-h-[32rem] overflow-y-auto pr-1.5 rounded-2xl glass-inset p-3.5">
      {turns.map((turn, index) => {
        const active = index === activeIndex;
        const handleClick = () => {
          if (onSeek) onSeek(turn.timestampSeconds);
        };
        return (
          <div
            key={`${turn.index}-${turn.timestampSeconds}`}
            id={`t-${turn.timestampSeconds}`}
            className={`scroll-mt-24 flex gap-3.5 p-2 rounded-xl transition ${
              active
                ? "bg-blue-500/15 border border-blue-500/30"
                : "hover:bg-white/[0.04] border border-transparent"
            }`}
          >
            <a
              href={`#t-${turn.timestampSeconds}`}
              onClick={(event) => {
                if (!onSeek) return;
                event.preventDefault();
                handleClick();
              }}
              className="shrink-0 font-mono text-[11px] text-blue-400 pt-0.5 w-12 hover:text-blue-300 font-semibold"
            >
              {turn.timestamp}
            </a>
            <button
              type="button"
              onClick={onSeek ? handleClick : undefined}
              className={`text-left flex-1 ${onSeek ? "cursor-pointer" : "cursor-default"}`}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 bg-white/[0.05] px-2 py-0.5 rounded-full inline-block mb-1 border border-white/[0.06]">
                {turn.speaker}
              </span>
              <p className="text-xs text-slate-300 leading-relaxed font-normal">{turn.text}</p>
            </button>
          </div>
        );
      })}
    </div>
  );
}

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
      <pre className="font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap max-h-[32rem] overflow-y-auto">
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
    <div className="space-y-2 max-h-[32rem] overflow-y-auto pr-1">
      {turns.map((turn, index) => {
        const active = index === activeIndex;
        const handleClick = () => {
          if (onSeek) onSeek(turn.timestampSeconds);
        };
        return (
          <div
            key={`${turn.index}-${turn.timestampSeconds}`}
            id={`t-${turn.timestampSeconds}`}
            className={`scroll-mt-24 flex gap-3 rounded-md px-2 py-1.5 -mx-2 ${
              active ? "bg-blue-500/10 border border-blue-500/20" : "border border-transparent"
            }`}
          >
            <a
              href={`#t-${turn.timestampSeconds}`}
              onClick={(event) => {
                if (!onSeek) return;
                event.preventDefault();
                handleClick();
              }}
              className="shrink-0 font-mono text-[11px] text-blue-400 pt-0.5 w-12 hover:text-blue-300"
            >
              {turn.timestamp}
            </a>
            <button
              type="button"
              onClick={onSeek ? handleClick : undefined}
              className="text-left flex-1"
            >
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{turn.speaker}</span>
              <p className="font-mono text-xs text-slate-300 leading-relaxed">{turn.text}</p>
            </button>
          </div>
        );
      })}
    </div>
  );
}

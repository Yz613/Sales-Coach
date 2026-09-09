import { parseTranscript } from "@/lib/transcript";

export default function TimestampedTranscript({
  transcriptText,
  durationSeconds,
}: {
  transcriptText: string;
  durationSeconds: number;
}) {
  const turns = parseTranscript(transcriptText, durationSeconds);

  if (!turns.length) {
    return (
      <pre className="font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
        {transcriptText}
      </pre>
    );
  }

  return (
    <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
      {turns.map((turn) => (
        <div key={`${turn.index}-${turn.timestampSeconds}`} id={`t-${turn.timestampSeconds}`} className="scroll-mt-24 flex gap-3">
          <a
            href={`#t-${turn.timestampSeconds}`}
            className="shrink-0 font-mono text-[11px] text-blue-400 pt-0.5 w-12 hover:text-blue-300"
          >
            {turn.timestamp}
          </a>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{turn.speaker}</span>
            <p className="font-mono text-xs text-slate-300 leading-relaxed">{turn.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

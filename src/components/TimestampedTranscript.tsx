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
      <pre className="font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto rounded-2xl glass-inset p-4">
        {transcriptText}
      </pre>
    );
  }

  return (
    <div className="space-y-2 max-h-96 overflow-y-auto pr-1.5 rounded-2xl glass-inset p-3.5">
      {turns.map((turn) => (
        <div key={`${turn.index}-${turn.timestampSeconds}`} id={`t-${turn.timestampSeconds}`} className="scroll-mt-24 flex gap-3.5 p-2 rounded-xl hover:bg-white/[0.04] transition">
          <a
            href={`#t-${turn.timestampSeconds}`}
            className="shrink-0 font-mono text-[11px] text-blue-400 pt-0.5 w-12 hover:text-blue-300 font-semibold"
          >
            {turn.timestamp}
          </a>
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 bg-white/[0.05] px-2 py-0.5 rounded-full inline-block mb-1 border border-white/[0.06]">{turn.speaker}</span>
            <p className="text-xs text-slate-300 leading-relaxed font-normal">{turn.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

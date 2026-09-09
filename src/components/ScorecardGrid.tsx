import { CheckCircle2, MinusCircle, XCircle } from "lucide-react";
import type { ScorecardMetric } from "@/lib/ai/review";
import type { SandlerStatus } from "@/types";

function tone(status: SandlerStatus) {
  if (status === "Pass") {
    return { badge: "bg-emerald-500/20 text-emerald-400", icon: CheckCircle2 };
  }
  if (status === "Incomplete") {
    return { badge: "bg-amber-500/20 text-amber-400", icon: MinusCircle };
  }
  return { badge: "bg-rose-500/20 text-rose-400", icon: XCircle };
}

export default function ScorecardGrid({ metrics }: { metrics: ScorecardMetric[] }) {
  if (!metrics.length) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {metrics.map((metric) => {
        const t = tone(metric.status);
        const Icon = t.icon;
        return (
          <div key={metric.key} className="rounded-lg border border-slate-800 bg-slate-950 p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">{metric.label}</span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${t.badge}`}>
                <Icon className="h-3 w-3" /> {metric.status}
              </span>
            </div>
            <p className="font-mono text-lg font-bold text-white">{metric.score}<span className="text-xs text-slate-500 font-normal"> / 10</span></p>
            <p className="text-xs text-slate-400 leading-relaxed">{metric.evidence}</p>
            {metric.cite?.quote && (
              <a href={`#t-${metric.cite.timestampSeconds}`} className="block text-[11px] text-blue-300 hover:text-blue-200">
                <span className="font-mono font-bold">{metric.cite.timestamp}</span>
                {" — "}
                <span className="italic">“{metric.cite.quote}”</span>
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}

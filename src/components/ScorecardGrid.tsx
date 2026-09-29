import { CheckCircle2, MinusCircle, XCircle } from "lucide-react";
import type { ScorecardMetric } from "@/lib/ai/review";
import type { SandlerStatus } from "@/types";

function tone(status: SandlerStatus) {
  if (status === "Pass") {
    return { badge: "border border-emerald-500/25 bg-emerald-500/10 text-[#248A3D]", icon: CheckCircle2 };
  }
  if (status === "Incomplete") {
    return { badge: "border border-amber-500/25 bg-amber-500/10 text-[#C45500]", icon: MinusCircle };
  }
  return { badge: "border border-rose-500/25 bg-rose-500/10 text-[#D70015]", icon: XCircle };
}

export default function ScorecardGrid({ metrics }: { metrics: ScorecardMetric[] }) {
  if (!metrics.length) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      {metrics.map((metric) => {
        const t = tone(metric.status);
        const Icon = t.icon;
        return (
          <div key={metric.key} className="rounded-2xl glass-inset p-5 space-y-2.5 border border-black/[0.06] hover:border-black/[0.12] transition">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#3a3a3c]">{metric.label}</span>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${t.badge}`}>
                <Icon className="h-3 w-3" /> {metric.status}
              </span>
            </div>
            <p className="font-mono text-lg font-bold text-[#1d1d1f]">{metric.score}<span className="text-xs text-[#86868b] font-normal"> / 10</span></p>
            <p className="text-xs text-[#6e6e73] leading-relaxed">{metric.evidence}</p>
            {metric.cite?.quote && (
              <a href={`#t-${metric.cite.timestampSeconds}`} className="block text-[11px] text-[#007AFF] hover:text-[#0071E3] rounded-xl bg-black/[0.03] border border-black/[0.06] p-2 hover:border-blue-500/30 transition">
                <span className="font-mono font-semibold">{metric.cite.timestamp}</span>
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

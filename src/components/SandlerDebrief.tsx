import { CheckCircle2, ClipboardList, MinusCircle, XCircle } from "lucide-react";
import type { DebriefMark, DebriefStatus } from "@/lib/sandlerChecklist";

function tone(status: DebriefStatus) {
  if (status === "Handled") return { icon: CheckCircle2, row: "border-emerald-500/20 bg-emerald-500/[0.05]", label: "text-emerald-300" };
  if (status === "Gap") return { icon: XCircle, row: "border-rose-500/25 bg-rose-500/[0.06]", label: "text-rose-300" };
  return { icon: MinusCircle, row: "border-white/[0.06] bg-white/[0.02]", label: "text-slate-500" };
}

export default function SandlerDebrief({ marks }: { marks: DebriefMark[] }) {
  const handled = marks.filter((mark) => mark.status === "Handled").length;
  const gaps = marks.filter((mark) => mark.status === "Gap").length;
  const sections: { section: string; items: DebriefMark[] }[] = [];
  for (const mark of marks) {
    const current = sections[sections.length - 1];
    if (!current || current.section !== mark.section) sections.push({ section: mark.section, items: [mark] });
    else current.items.push(mark);
  }

  return (
    <div className="rounded-2xl glass-card p-6 sm:p-7 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-white/[0.08] pb-4">
        <div>
          <div className="flex items-center gap-2 text-blue-400 font-bold text-xs uppercase tracking-wider">
            <ClipboardList className="h-4 w-4" /> Sales Call Debrief
          </div>
          <h2 className="text-lg font-bold text-white mt-1 tracking-tight">Sandler checklist</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            The debrief boxes and the skills sheet. One call is a check, not a 1–5 mastery rating. Pre-call prep stays blank unless it shows up on the recording.
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs shrink-0">
          <span className="rounded-full bg-emerald-500/10 px-3 py-1 font-bold text-emerald-400 border border-emerald-500/20">{handled} handled</span>
          <span className="rounded-full bg-rose-500/10 px-3 py-1 font-bold text-rose-400 border border-rose-500/20">{gaps} gaps</span>
        </div>
      </div>

      <div className="space-y-5">
        {sections.map((section) => (
          <section key={section.section} className="space-y-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{section.section}</h3>
            <div className="space-y-1.5">
              {section.items.map((item) => {
                const style = tone(item.status);
                const Icon = style.icon;
                return (
                  <div key={item.id} className={`rounded-xl border px-3 py-2.5 ${style.row}`}>
                    <div className="flex items-start gap-2">
                      <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${style.label}`} />
                      <div className="min-w-0">
                        <div className="text-sm text-slate-100">{item.label}</div>
                        {item.status !== "NotApplicable" ? (
                          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{item.evidence}</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

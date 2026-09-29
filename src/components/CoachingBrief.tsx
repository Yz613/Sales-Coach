import { CheckCircle2, Flame, Wrench } from "lucide-react";
import type { CoachingBrief as CoachingBriefModel } from "@/lib/methodology";

export default function CoachingBriefCard({ brief }: { brief: CoachingBriefModel }) {
  const sections = [
    {
      label: "What went well",
      body: brief.praiseReinforcement,
      icon: CheckCircle2,
      tone: "text-[#248A3D] border-emerald-500/25 bg-emerald-500/[0.06]",
    },
    {
      label: "Gaps",
      body: brief.tacticalGaps,
      icon: Flame,
      tone: "text-[#FF3B30] border-rose-500/25 bg-rose-500/[0.06]",
    },
    {
      label: "Drills for next time",
      body: brief.remedialDrills,
      icon: Wrench,
      tone: "text-[#007AFF] border-blue-500/25 bg-blue-500/[0.06]",
    },
  ];

  return (
    <div className="rounded-2xl glass-card p-6 sm:p-7 space-y-4">
      <div>
        <div className="flex items-center gap-2 text-[#248A3D] font-bold text-xs uppercase tracking-wider">
          <CheckCircle2 className="h-4 w-4" /> Coaching talk track
        </div>
        <h2 className="text-lg font-bold text-[#1d1d1f] mt-1 tracking-tight">Reinforce, then correct</h2>
        <p className="text-xs text-[#6e6e73]">What to keep comes before the gaps and the line to use next time.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <div key={section.label} className={`rounded-2xl border p-4 space-y-2 ${section.tone}`}>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                <Icon className="h-3.5 w-3.5" />
                {section.label}
              </div>
              <p className="text-sm text-[#1d1d1f] leading-relaxed">{section.body}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

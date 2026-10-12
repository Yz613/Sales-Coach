"use client";

import {
  PhoneCall,
  LayoutDashboard,
  Briefcase,
  BarChart3,
  Users,
  GraduationCap,
  BookOpen,
  Plug,
} from "lucide-react";

export type DemoTab =
  | "calls"
  | "dashboard"
  | "deals"
  | "forecast"
  | "reps"
  | "coach"
  | "library"
  | "integrations";

export const DEMO_TABS: Array<{ id: DemoTab; label: string; icon: typeof PhoneCall }> = [
  { id: "calls", label: "Call Bank", icon: PhoneCall },
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "deals", label: "Deals", icon: Briefcase },
  { id: "forecast", label: "Forecast", icon: BarChart3 },
  { id: "reps", label: "Reps", icon: Users },
  { id: "coach", label: "Coach", icon: GraduationCap },
  { id: "library", label: "Library", icon: BookOpen },
  { id: "integrations", label: "Integrations", icon: Plug },
];

export default function DemoWorkspaceTabs({
  activeTab,
  onSelectTab,
}: {
  activeTab: DemoTab;
  onSelectTab: (tab: DemoTab) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
      {DEMO_TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelectTab(tab.id)}
            className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition ${
              isActive
                ? "bg-[#007AFF] text-white shadow-xs"
                : "bg-white text-[#3a3a3c] border border-black/[0.08] hover:bg-black/[0.04] hover:text-[#1d1d1f]"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

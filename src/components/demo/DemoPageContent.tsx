"use client";

import { useEffect, useState } from "react";
import {
  DEMO_CALLS,
  DEMO_SELF_HOST_HREF,
  DEMO_SIGN_UP_HREF,
} from "@/lib/demo/workspace";
import DemoWorkspaceTabs, { type DemoTab } from "@/components/demo/DemoWorkspaceTabs";
import DemoCallsView from "@/components/demo/DemoCallsView";
import DemoDashboardView from "@/components/demo/DemoDashboardView";
import DemoDealsView from "@/components/demo/DemoDealsView";
import DemoForecastView from "@/components/demo/DemoForecastView";
import DemoRepsView from "@/components/demo/DemoRepsView";
import DemoCoachView from "@/components/demo/DemoCoachView";
import DemoLibraryView from "@/components/demo/DemoLibraryView";
import DemoIntegrationsView from "@/components/demo/DemoIntegrationsView";

export default function DemoPageContent({ initialTab = "calls" }: { initialTab?: DemoTab }) {
  const [activeTab, setActiveTab] = useState<DemoTab>(initialTab);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab") as DemoTab | null;
    if (tabParam && ["calls", "dashboard", "deals", "forecast", "reps", "coach", "library", "integrations"].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, []);

  const handleSelectTab = (tab: DemoTab) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    if (tab === "calls") {
      url.searchParams.delete("tab");
    } else {
      url.searchParams.set("tab", tab);
    }
    window.history.replaceState({}, "", url.toString());
  };

  return (
    <div className="space-y-8">
      {/* Hero Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[13px] font-semibold text-[#007AFF] uppercase tracking-wider">
            Try the live demo, no signup
          </p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#1d1d1f]">
            Fieldnote sample team workspace
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#6e6e73]">
            Explore the complete Sales Coach platform: call evaluations, executive dashboards, CRM deals, revenue forecasts, rep progression, coaching rules, and moment libraries.
          </p>
        </div>
        <div className="flex gap-2 text-sm font-semibold shrink-0">
          <a
            href={DEMO_SIGN_UP_HREF}
            className="rounded-full bg-[#007AFF] px-4 py-2 text-white hover:bg-[#0071E3] transition shadow-xs"
          >
            Sign up
          </a>
          <a
            href={DEMO_SELF_HOST_HREF}
            className="rounded-full bg-white px-4 py-2 text-[#1d1d1f] shadow-[0_0_0_1px_rgba(0,0,0,0.08)] hover:bg-black/[0.03] transition"
          >
            Self-host
          </a>
        </div>
      </div>

      {/* Product Feature Tabs */}
      <div className="border-b border-black/[0.08] pb-3">
        <DemoWorkspaceTabs activeTab={activeTab} onSelectTab={handleSelectTab} />
      </div>

      {/* Active Feature View */}
      <div>
        {activeTab === "calls" && <DemoCallsView calls={DEMO_CALLS} />}
        {activeTab === "dashboard" && <DemoDashboardView />}
        {activeTab === "deals" && <DemoDealsView />}
        {activeTab === "forecast" && <DemoForecastView />}
        {activeTab === "reps" && <DemoRepsView />}
        {activeTab === "coach" && <DemoCoachView />}
        {activeTab === "library" && <DemoLibraryView />}
        {activeTab === "integrations" && <DemoIntegrationsView />}
      </div>
    </div>
  );
}

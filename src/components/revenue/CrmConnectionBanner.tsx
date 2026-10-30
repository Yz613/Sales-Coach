"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Plug } from "lucide-react";
import IntegrationLogo from "./IntegrationLogo";

export interface CrmConnectionBannerProps {
  pageName?: "deals" | "forecast" | "crm" | string;
  className?: string;
}

export default function CrmConnectionBanner({ pageName = "deals", className = "" }: CrmConnectionBannerProps) {
  const isForecast = pageName === "forecast";
  const entityDescription = isForecast
    ? "revenue projections, pipeline weights, and quota attainment"
    : "deals, pipeline stages, activity flags, and next steps";

  return (
    <section
      role="region"
      aria-label="CRM Connection Required"
      className={`relative overflow-hidden rounded-2xl border border-[#ff7a59]/30 bg-gradient-to-br from-[#fff7f5] via-white to-[#fffaf8] p-5 sm:p-6 shadow-xs ${className}`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="hidden sm:block shrink-0 pt-0.5">
            <IntegrationLogo provider="hubspot" large />
          </div>
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#ff7a59]/10 px-2.5 py-0.5 text-xs font-semibold text-[#ff7a59]">
              <Plug size={12} className="shrink-0" />
              <span>CRM Not Connected</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[#1d1d1f]">
              Hey, the reason there&apos;s nothing here is because you need to connect your HubSpot
            </h2>
            <p className="text-sm leading-relaxed text-[#6e6e73]">
              Sales Coach pulls your {entityDescription} directly from your CRM. Connect your HubSpot account (or another CRM) to see your pipeline and start tracking here.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-3 shrink-0">
          <Link
            href="/admin/integrations/hubspot"
            className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-[#ff7a59] px-6 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-[#e66a49] active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff7a59] focus-visible:ring-offset-2"
          >
            <span>Connect your HubSpot</span>
            <ArrowRight size={18} />
          </Link>
          <Link
            href="/admin/integrations"
            className="text-xs font-medium text-[#007AFF] hover:underline text-center sm:text-right"
          >
            Or connect Pipedrive, Attio, or another CRM →
          </Link>
        </div>
      </div>
    </section>
  );
}

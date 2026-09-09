"use client";

import { Building2 } from "lucide-react";
import { OrganizationProfile, Show, useOrganization } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/clerk-ui";

export default function OrganizationSettingsPanel({
  variant,
}: {
  variant: "status" | "profile";
}) {
  const { organization, membership } = useOrganization();

  if (variant === "status") {
    return (
      <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800">
        <div className="flex items-center gap-2">
          <Building2 className="h-3.5 w-3.5 text-indigo-400" />
          <span className="font-semibold text-white">Active organization:</span>
          <span className="text-slate-400">
            {organization?.name || "None selected — use the org switcher in the header"}
          </span>
        </div>
        {membership?.role && (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
            {membership.role}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-6 space-y-5">
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <Building2 className="h-5 w-5 text-indigo-400" />
        <div>
          <h2 className="text-base font-bold text-white">Organization members & profile</h2>
          <p className="text-xs text-slate-400">
            Invite teammates, change org roles, and update the organization profile. Org admins map to Admin access in this app.
          </p>
        </div>
      </div>
      <Show
        when="signed-in"
        fallback={<p className="text-sm text-slate-400">Sign in to manage your organization.</p>}
      >
        <div className="overflow-hidden rounded-lg border border-slate-800">
          <OrganizationProfile routing="hash" appearance={clerkAppearance} />
        </div>
      </Show>
    </div>
  );
}

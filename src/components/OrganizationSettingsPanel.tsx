"use client";

import { Building2 } from "lucide-react";
import { useOrganization } from "@clerk/nextjs";
import InviteTeammatesForm from "./InviteTeammatesForm";

export default function OrganizationSettingsPanel() {
  const { isLoaded, organization } = useOrganization();

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-6 space-y-5">
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-indigo-400" />
          <div>
            <h2 className="text-base font-bold text-white">Invite teammates</h2>
            <p className="text-xs text-slate-400">
              Active team:{" "}
              <span className="font-semibold text-white">
                {!isLoaded ? "…" : organization?.name || "None selected"}
              </span>
            </p>
          </div>
        </div>
      </div>
      <InviteTeammatesForm compact />
    </div>
  );
}

"use client";

import Link from "next/link";
import { Building2 } from "lucide-react";
import { OrganizationSwitcher, Show, useOrganization } from "@clerk/nextjs";
import { clerkAppearance, CLERK_PATHS } from "@/lib/clerk-ui";

function orgRoleLabel(role?: string | null) {
  if (role === "org:admin") return "Admin";
  if (role === "org:member") return "Member";
  return role?.replace(/^org:/, "") || null;
}

export default function TeamSwitcher({ canManage = false }: { canManage?: boolean }) {
  const { isLoaded, organization, membership } = useOrganization();
  const roleLabel = orgRoleLabel(membership?.role);

  return (
    <Show when="signed-in">
      <div className="flex items-center gap-1.5">
        <div className="flex min-w-0 items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/70 px-2 py-1">
          <Building2 className="h-3.5 w-3.5 shrink-0 text-sky-400" />
          <div className="min-w-0 leading-tight">
            <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
              Team
            </div>
            <div className="max-w-[9rem] truncate text-[11px] font-semibold text-white sm:max-w-[12rem]">
              {!isLoaded ? "…" : organization?.name || "None selected"}
            </div>
          </div>
          {roleLabel && (
            <span className="hidden rounded border border-slate-700 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-slate-400 lg:inline">
              {roleLabel}
            </span>
          )}
          <OrganizationSwitcher
            hidePersonal
            organizationProfileMode="navigation"
            organizationProfileUrl={CLERK_PATHS.organizationProfile}
            createOrganizationMode="navigation"
            createOrganizationUrl={CLERK_PATHS.createOrganization}
            afterSelectOrganizationUrl={CLERK_PATHS.afterSignIn}
            afterCreateOrganizationUrl={CLERK_PATHS.afterSignIn}
            appearance={clerkAppearance}
          />
        </div>
        {canManage && !organization && isLoaded && (
          <Link
            href="/select-organization"
            className="hidden sm:inline-flex rounded-lg border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-[11px] font-semibold text-sky-300 hover:bg-sky-500/20"
          >
            Set team
          </Link>
        )}
      </div>
    </Show>
  );
}

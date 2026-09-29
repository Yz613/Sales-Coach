"use client";

import Link from "next/link";
import { Building2 } from "lucide-react";
import { OrganizationSwitcher, Show, useOrganization } from "@clerk/nextjs";
import { clerkAppearance, CLERK_PATHS } from "@/lib/clerk-ui";
import { useAppAuth } from "@/lib/auth-context";

function orgRoleLabel(role?: string | null) {
  if (role === "org:admin") return "Admin";
  if (role === "org:member") return "Member";
  return role?.replace(/^org:/, "") || null;
}

function ClerkTeamSwitcherContent({ canManage = false }: { canManage?: boolean }) {
  const { isLoaded, organization, membership } = useOrganization();
  const roleLabel = orgRoleLabel(membership?.role);

  return (
    <Show when="signed-in">
      <div className="flex items-center gap-1.5">
        <div className="flex min-w-0 items-center gap-2 rounded-xl border border-black/[0.08] bg-black/[0.03] px-2.5 py-1.5 hover:border-black/[0.12] hover:bg-black/[0.05] transition">
          <Building2 className="h-3.5 w-3.5 shrink-0 text-[#007AFF]" />
          <span className="max-w-[8rem] sm:max-w-[11rem] truncate text-xs font-medium text-[#1d1d1f]">
            {!isLoaded ? "…" : organization?.name || "Select Team"}
          </span>
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
            className="hidden sm:inline-flex rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-[11px] font-medium text-[#007AFF] hover:bg-blue-500/20 transition"
          >
            Set team
          </Link>
        )}
      </div>
    </Show>
  );
}

export default function TeamSwitcher({ canManage = false }: { canManage?: boolean }) {
  const { isClerkConfigured } = useAppAuth();
  if (!isClerkConfigured) return null;
  return <ClerkTeamSwitcherContent canManage={canManage} />;
}

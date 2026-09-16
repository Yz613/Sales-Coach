"use client";

import { OrganizationList, TaskChooseOrganization, useSession } from "@clerk/nextjs";
import ClerkGate from "@/components/ClerkGate";
import { clerkAppearance, clerkUrl } from "@/lib/clerk-ui";
import { useAppAuth } from "@/lib/auth-context";

function ClerkSelectTeamContent() {
  const { isLoaded, session } = useSession();
  const pendingChooseTeam = session?.currentTask?.key === "choose-organization";

  return (
    <ClerkGate>
      {!isLoaded ? (
        <p className="text-sm text-slate-400">Loading teams…</p>
      ) : pendingChooseTeam ? (
        <TaskChooseOrganization
          redirectUrlComplete={clerkUrl("/")}
          appearance={clerkAppearance}
        />
      ) : (
        <OrganizationList
          hidePersonal
          afterSelectOrganizationUrl={clerkUrl("/")}
          afterCreateOrganizationUrl={clerkUrl("/subscribe")}
          appearance={clerkAppearance}
        />
      )}
    </ClerkGate>
  );
}

export default function SelectTeamPage() {
  const { isClerkConfigured } = useAppAuth();

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4">
      <div className="text-center space-y-1">
        <h1 className="text-xl font-bold text-white">Choose your team</h1>
        <p className="text-sm text-slate-400">Select a team to finish signing in.</p>
      </div>
      {isClerkConfigured ? (
        <ClerkSelectTeamContent />
      ) : (
        <div className="mx-auto max-w-lg rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 text-sm text-amber-200">
          Team sign-in is not configured in this environment.
        </div>
      )}
    </div>
  );
}

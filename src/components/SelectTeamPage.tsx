"use client";

import { OrganizationList, TaskChooseOrganization, useSession } from "@clerk/nextjs";
import ClerkGate from "@/components/ClerkGate";
import { clerkAppearance, clerkUrl } from "@/lib/clerk-ui";

export default function SelectTeamPage() {
  const { isLoaded, session } = useSession();
  const pendingChooseTeam = session?.currentTask?.key === "choose-organization";

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4">
      <div className="text-center space-y-1">
        <h1 className="text-xl font-bold text-white">Choose your team</h1>
        <p className="text-sm text-slate-400">Select a team to finish signing in.</p>
      </div>
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
            afterCreateOrganizationUrl={clerkUrl("/")}
            appearance={clerkAppearance}
          />
        )}
      </ClerkGate>
    </div>
  );
}

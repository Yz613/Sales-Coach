import { OrganizationList } from "@clerk/nextjs";
import ClerkGate from "@/components/ClerkGate";
import { clerkAppearance, clerkUrl } from "@/lib/clerk-ui";

export const dynamic = "force-dynamic";

export default function SelectOrganizationPage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4">
      <div className="text-center space-y-1">
        <h1 className="text-xl font-bold text-white">Choose your organization</h1>
        <p className="text-sm text-slate-400">Create or select a team workspace to continue.</p>
      </div>
      <ClerkGate>
        <OrganizationList
          hidePersonal
          afterSelectOrganizationUrl={clerkUrl("/")}
          afterCreateOrganizationUrl={clerkUrl("/")}
          appearance={clerkAppearance}
        />
      </ClerkGate>
    </div>
  );
}

import { CreateOrganization } from "@clerk/nextjs";
import ClerkGate from "@/components/ClerkGate";
import { clerkAppearance, clerkUrl } from "@/lib/clerk-ui";

export const dynamic = "force-dynamic";

export default function CreateOrganizationPage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4">
      <div className="text-center space-y-1">
        <h1 className="text-xl font-bold text-white">Create an organization</h1>
        <p className="text-sm text-slate-400">Teams share reps, calls, scripts, and coach settings.</p>
      </div>
      <ClerkGate>
        <CreateOrganization
          routing="hash"
          afterCreateOrganizationUrl={clerkUrl("/")}
          appearance={clerkAppearance}
        />
      </ClerkGate>
    </div>
  );
}

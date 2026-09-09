import { OrganizationProfile } from "@clerk/nextjs";
import ClerkGate from "@/components/ClerkGate";
import { clerkAppearance } from "@/lib/clerk-ui";

export const dynamic = "force-dynamic";

export default function OrganizationProfilePage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <ClerkGate>
        <OrganizationProfile routing="hash" appearance={clerkAppearance} />
      </ClerkGate>
    </div>
  );
}

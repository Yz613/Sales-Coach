import { UserProfile } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/clerk-ui";

export const dynamic = "force-dynamic";

export default function UserProfilePage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <UserProfile routing="hash" appearance={clerkAppearance} />
    </div>
  );
}

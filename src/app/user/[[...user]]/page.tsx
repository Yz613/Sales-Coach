import { UserProfile, SignOutButton } from "@clerk/nextjs";
import ClerkGate from "@/components/ClerkGate";
import { clerkAppearance } from "@/lib/clerk-ui";

export const dynamic = "force-dynamic";

export default async function UserProfilePage({ searchParams }: { searchParams: Promise<{ security?: string }> }) {
  const securityRequired = (await searchParams).security === "mfa";
  return (
    <div className="flex min-h-[70vh] flex-col gap-6 items-center justify-center">
      <ClerkGate>
        {securityRequired && <div role="alert" className="max-w-xl rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm">
          <h1 className="font-semibold text-base">Two-step verification required</h1>
          <p className="mt-2">Enable two-step verification under Security, then sign out and sign back in. Your second verification remains valid for eight hours.</p>
          <SignOutButton redirectUrl="/app/sign-in"><button className="mt-3 rounded-lg border px-3 py-2 font-medium">Sign out and sign in again</button></SignOutButton>
        </div>}
        <UserProfile routing="hash" appearance={clerkAppearance} />
      </ClerkGate>
    </div>
  );
}

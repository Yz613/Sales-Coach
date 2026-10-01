import { SignOutButton } from "@clerk/nextjs";
import ClerkGate from "@/components/ClerkGate";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function SessionRecoveryPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center gap-4 px-6">
      <h1 className="text-2xl font-semibold">Reconnect your session</h1>
      <p className="text-sm text-[#6e6e73]">Your session could not be verified. Sign out and sign in again to reconnect to your workspace. If sign-in is temporarily unavailable, try again shortly.</p>
      <ClerkGate>
        <SignOutButton redirectUrl="/app/sign-in">
          <button className="rounded-xl bg-[#007AFF] px-4 py-3 text-sm font-medium text-white">Sign out and sign in again</button>
        </SignOutButton>
      </ClerkGate>
      <Link href="/" className="text-sm text-[#007AFF]">Try opening your workspace again</Link>
    </div>
  );
}

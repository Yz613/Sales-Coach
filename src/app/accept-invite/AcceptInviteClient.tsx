"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SignIn, SignUp, useAuth } from "@clerk/nextjs";
import ClerkGate from "@/components/ClerkGate";
import { clerkAppearance, CLERK_PATHS } from "@/lib/clerk-ui";
import { useAppAuth } from "@/lib/auth-context";

function AcceptInviteInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const ticket = params.get("__clerk_ticket");
  const status = params.get("__clerk_status");

  useEffect(() => {
    if (!isLoaded) return;
    if (status === "complete" || (isSignedIn && !ticket)) {
      router.replace(CLERK_PATHS.afterSignIn);
    }
  }, [isLoaded, isSignedIn, status, ticket, router]);

  if (!ticket) {
    return (
      <div className="max-w-md text-center space-y-2">
        <h1 className="text-xl font-semibold text-white">Invite link needed</h1>
        <p className="text-sm text-slate-400">
          This page accepts a team invite. Ask your admin to resend it, or use the copyable link from the Invite page.
        </p>
      </div>
    );
  }

  if (status === "sign_in") {
    return (
      <SignIn
        routing="hash"
        appearance={clerkAppearance}
        forceRedirectUrl={CLERK_PATHS.afterSignIn}
        signUpUrl={CLERK_PATHS.signUp}
      />
    );
  }

  return (
    <SignUp
      routing="hash"
      appearance={clerkAppearance}
      forceRedirectUrl={CLERK_PATHS.afterSignIn}
      signInUrl={CLERK_PATHS.signIn}
    />
  );
}

export default function AcceptInviteClient() {
  const { isClerkConfigured } = useAppAuth();

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      {isClerkConfigured ? (
        <ClerkGate>
          <Suspense fallback={<p className="text-sm text-slate-400">Opening invite…</p>}>
            <AcceptInviteInner />
          </Suspense>
        </ClerkGate>
      ) : (
        <div className="mx-auto max-w-lg rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 text-sm text-amber-200">
          Team sign-in is not configured in this environment.
        </div>
      )}
    </div>
  );
}

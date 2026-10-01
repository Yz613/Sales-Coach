"use client";

import { useEffect, useState } from "react";
import { SignIn, useSession } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { ClerkAuthFeedback } from "@/components/ClerkAuthForm";
import { signInDestination } from "@/lib/signInRedirect";
import { stripAppBasePath } from "@/lib/public-path";

export default function SignInForm() {
  const { isLoaded, session } = useSession();
  const router = useRouter();
  const [redirectFailed, setRedirectFailed] = useState(false);
  const destination = signInDestination({
    isLoaded,
    sessionStatus: session?.status,
    currentTaskKey: session?.currentTask?.key,
  });

  useEffect(() => {
    if (!destination || !session) return;
    const currentSession = session;
    const target = stripAppBasePath(destination);
    let cancelled = false;
    async function openWorkspace() {
      try {
        // Sync the session cookie before the server checks workspace access.
        if (currentSession.status === "active") await currentSession.getToken({ skipCache: true });
        if (!cancelled) router.replace(target);
      } catch {
        if (!cancelled) setRedirectFailed(true);
      }
    }
    void openWorkspace();
    return () => { cancelled = true; };
  }, [destination, session, router]);

  if (destination) {
    return (
      <div className="max-w-sm space-y-3 text-center text-sm" role={redirectFailed ? "alert" : "status"}>
        <p>{redirectFailed ? "Your session could not reconnect automatically." : "You’re signed in. Opening your workspace…"}</p>
        <a href={destination} className="inline-block rounded-xl bg-[#007AFF] px-4 py-2.5 font-medium text-white hover:bg-[#0071E3]">
          Open workspace
        </a>
      </div>
    );
  }

  // Hash routing keeps Clerk's sub-routes compatible with Next's /app base path.
  return <SignIn routing="hash" fallback={<ClerkAuthFeedback />} />;
}

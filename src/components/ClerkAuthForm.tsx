"use client";

import { useEffect, useState } from "react";
import { ClerkFailed, ClerkLoaded, ClerkLoading } from "@clerk/nextjs";

const LOAD_HINT_MS = 8000;
const LOAD_FAIL_MS = 12000;

// Also used as the widget's fallback: Clerk can load before its form mounts.
export function ClerkAuthFeedback({ failed = false }: { failed?: boolean }) {
  const [slow, setSlow] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const stuck = failed || timedOut;

  useEffect(() => {
    const hint = window.setTimeout(() => setSlow(true), LOAD_HINT_MS);
    const fail = window.setTimeout(() => setTimedOut(true), LOAD_FAIL_MS);
    return () => {
      window.clearTimeout(hint);
      window.clearTimeout(fail);
    };
  }, []);

  return (
    <div className="max-w-sm space-y-3 text-center text-sm text-[#1d1d1f]" role={stuck || slow ? "alert" : "status"} aria-live="polite">
      <p>{stuck ? "Sign-in could not load." : slow ? "Sign-in is taking longer than expected." : "Loading sign-in…"}</p>
      {stuck || slow ? (
        <>
          <p className="text-[#6e6e73]">
            Try reloading. If sign-in still won’t open, try a private window or allow this site’s sign-in requests in your browser extensions.
          </p>
          <button type="button" onClick={() => window.location.reload()} className="rounded-xl bg-[#007AFF] px-4 py-2.5 font-medium text-white hover:bg-[#0071E3]">
            Reload sign-in
          </button>
        </>
      ) : null}
    </div>
  );
}

export function ClerkAuthContent({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ClerkLoading>
        <ClerkAuthFeedback />
      </ClerkLoading>
      <ClerkFailed><ClerkAuthFeedback failed /></ClerkFailed>
      <ClerkLoaded>{children}</ClerkLoaded>
    </>
  );
}

export default function ClerkAuthForm({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4">
      <ClerkAuthContent>{children}</ClerkAuthContent>
    </div>
  );
}

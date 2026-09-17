"use client";

import { useEffect, useState } from "react";
import { ClerkLoaded, ClerkLoading } from "@clerk/nextjs";

const LOAD_HINT_MS = 8000;

export default function ClerkAuthForm({ children }: { children: React.ReactNode }) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), LOAD_HINT_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4">
      <ClerkLoading>
        <div className="max-w-sm text-center text-sm text-slate-400">
          {slow ? (
            <>
              Sign-in did not load. Disable ad blockers and privacy extensions for
              refreshqueue.com and clerk.refreshqueue.com, then refresh.
            </>
          ) : (
            "Loading sign-in…"
          )}
        </div>
      </ClerkLoading>
      <ClerkLoaded>{children}</ClerkLoaded>
    </div>
  );
}

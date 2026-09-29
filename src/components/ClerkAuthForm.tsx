"use client";

import { useEffect, useState } from "react";
import { ClerkLoaded, ClerkLoading, useClerk } from "@clerk/nextjs";

const LOAD_HINT_MS = 8000;

export default function ClerkAuthForm({ children }: { children: React.ReactNode }) {
  const clerk = useClerk();
  const [slow, setSlow] = useState(false);
  const stalled = !clerk.loaded && clerk.status !== "loading";

  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), LOAD_HINT_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4">
      <ClerkLoading>
        <div className="max-w-sm text-center text-sm text-[#1d1d1f]">
          {slow
            ? "Sign-in is still loading. Refresh the page if this stays empty."
            : "Loading sign-in…"}
        </div>
      </ClerkLoading>
      {stalled ? (
        <div className="max-w-sm text-center text-sm text-[#1d1d1f]">
          Sign-in could not load. Refresh the page and try again.
        </div>
      ) : null}
      <ClerkLoaded>{children}</ClerkLoaded>
    </div>
  );
}

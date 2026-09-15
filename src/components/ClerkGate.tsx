"use client";

import type { ReactNode } from "react";

export default function ClerkGate({ children }: { children: ReactNode }) {
  const ready = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim());
  if (!ready) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 text-sm text-amber-200">
        Team sign-in is not configured in this environment.
      </div>
    );
  }
  return <>{children}</>;
}

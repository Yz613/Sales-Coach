"use client";

import type { ReactNode } from "react";

export default function ClerkGate({ children }: { children: ReactNode }) {
  const ready = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim());
  if (!ready) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-[#C45500]/25 bg-[#FF9500]/10 p-6 text-sm text-[#C45500] font-medium text-center">
        Team sign-in is not configured in this environment.
      </div>
    );
  }
  return <>{children}</>;
}

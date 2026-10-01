"use client";

import type { ReactNode } from "react";
import { useAppAuth } from "@/lib/auth-context";
import { ClerkAuthContent } from "@/components/ClerkAuthForm";

export default function ClerkGate({ children }: { children: ReactNode }) {
  // The provider receives runtime configuration from the server layout.
  const { isClerkConfigured: ready } = useAppAuth();
  if (!ready) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-[#C45500]/25 bg-[#FF9500]/10 p-6 text-sm text-[#C45500] font-medium text-center">
        Team sign-in is not configured in this environment.
      </div>
    );
  }
  return <ClerkAuthContent>{children}</ClerkAuthContent>;
}

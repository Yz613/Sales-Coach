"use client";

import React from "react";
import { AuthContextProvider } from "@/lib/auth-context";
import { ClerkProvider, useUser } from "@clerk/nextjs";
import type { UserRole } from "@/lib/auth";

interface AuthProviderProps {
  children: React.ReactNode;
  initialRole?: UserRole;
  // Passed from the server layout so SSR and the client hydrate with the same key.
  publishableKey?: string;
}

// Inner component used when ClerkProvider is active to link Clerk's useUser with our AuthContext
function ClerkBridge({ children, initialRole = "admin" }: { children: React.ReactNode; initialRole?: UserRole }) {
  const { user } = useUser();

  const clerkUser = user
    ? {
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress,
        name: user.fullName || user.firstName || "User",
      }
    : null;

  return (
    <AuthContextProvider
      initialRole={initialRole}
      isClerkConfigured={true}
      clerkUser={clerkUser}
    >
      {children}
    </AuthContextProvider>
  );
}

export default function AuthProvider({
  children,
  initialRole = "admin",
  publishableKey,
}: AuthProviderProps) {
  const resolvedKey = (publishableKey || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "").trim();
  const isClerkReady = Boolean(resolvedKey);

  if (isClerkReady) {
    return (
      <ClerkProvider
        publishableKey={resolvedKey}
        signInUrl="/app/sign-in"
        signUpUrl="/app/sign-up"
        signInFallbackRedirectUrl="/app"
        signUpFallbackRedirectUrl="/app"
        afterSignOutUrl="/app"
      >
        <ClerkBridge initialRole={initialRole}>{children}</ClerkBridge>
      </ClerkProvider>
    );
  }

  // Graceful fallback when Clerk keys are not yet configured in .env
  return (
    <AuthContextProvider initialRole={initialRole} isClerkConfigured={false}>
      {children}
    </AuthContextProvider>
  );
}

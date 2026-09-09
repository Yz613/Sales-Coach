"use client";

import React from "react";
import { AuthContextProvider } from "@/lib/auth-context";
import { ClerkProvider, useUser } from "@clerk/nextjs";
import type { UserRole } from "@/lib/auth";

interface AuthProviderProps {
  children: React.ReactNode;
  initialRole?: UserRole;
}

// Inner component used when ClerkProvider is active to link Clerk's useUser with our AuthContext
function ClerkBridge({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();

  const clerkUser = user
    ? {
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress,
        name: user.fullName || user.firstName || "User",
      }
    : null;

  const metadataRole = (user?.publicMetadata as Record<string, unknown>)?.role as UserRole | undefined;

  return (
    <AuthContextProvider
      initialRole={metadataRole || "member"}
      isClerkConfigured={true}
      clerkUser={clerkUser}
    >
      {children}
    </AuthContextProvider>
  );
}

export default function AuthProvider({ children, initialRole = "admin" }: AuthProviderProps) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const isClerkReady = Boolean(publishableKey && publishableKey.trim() !== "");

  if (isClerkReady) {
    return (
      <ClerkProvider
        publishableKey={publishableKey}
        signInUrl="/app/sign-in"
        signUpUrl="/app/sign-up"
        signInFallbackRedirectUrl="/app"
        signUpFallbackRedirectUrl="/app"
        afterSignOutUrl="/app"
      >
        <ClerkBridge>{children}</ClerkBridge>
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

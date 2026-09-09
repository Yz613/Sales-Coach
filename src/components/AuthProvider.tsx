"use client";

import React from "react";
import { AuthContextProvider } from "@/lib/auth-context";
import { ClerkProvider, useUser } from "@clerk/nextjs";
import type { UserRole } from "@/lib/auth";
import { CLERK_PATHS, clerkAppearance } from "@/lib/clerk-ui";

interface AuthProviderProps {
  children: React.ReactNode;
  initialRole?: UserRole;
}

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

export default function AuthProvider({ children, initialRole = "admin" }: AuthProviderProps) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const isClerkReady = Boolean(publishableKey && publishableKey.trim() !== "");

  if (isClerkReady) {
    return (
      <ClerkProvider
        publishableKey={publishableKey}
        appearance={clerkAppearance}
        signInUrl={CLERK_PATHS.signIn}
        signUpUrl={CLERK_PATHS.signUp}
        signInFallbackRedirectUrl={CLERK_PATHS.afterSignIn}
        signUpFallbackRedirectUrl={CLERK_PATHS.afterSignIn}
        afterSignOutUrl={CLERK_PATHS.afterSignOut}
        taskUrls={{ "choose-organization": CLERK_PATHS.selectOrganization }}
      >
        <ClerkBridge initialRole={initialRole}>{children}</ClerkBridge>
      </ClerkProvider>
    );
  }

  return (
    <AuthContextProvider initialRole={initialRole} isClerkConfigured={false}>
      {children}
    </AuthContextProvider>
  );
}

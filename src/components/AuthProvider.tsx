"use client";

import React from "react";
import { AuthContextProvider } from "@/lib/auth-context";
import { ClerkProvider, useSession, useUser } from "@clerk/nextjs";
import type { UserRole } from "@/lib/auth";
import { CLERK_PATHS, clerkAppearance, teamLocalization } from "@/lib/clerk-ui";
import ActiveTeamSync from "@/components/ActiveTeamSync";

type AuthUserPreview = { id?: string | null; email?: string; name?: string } | null;

interface AuthProviderProps {
  children: React.ReactNode;
  initialRole?: UserRole;
  // Passed from the server layout so SSR and the client hydrate with the same key.
  publishableKey?: string;
  initialUser?: AuthUserPreview;
  skipRoleFetch?: boolean;
}

function ClerkBridge({
  children,
  initialRole = "admin",
  initialUser = null,
  skipRoleFetch = false,
}: {
  children: React.ReactNode;
  initialRole?: UserRole;
  initialUser?: AuthUserPreview;
  skipRoleFetch?: boolean;
}) {
  const { user } = useUser();
  const { session } = useSession();

  const clerkUser =
    user && session?.status === "active"
      ? {
          id: user.id,
          email: user.primaryEmailAddress?.emailAddress,
          name: user.fullName || user.firstName || "User",
        }
      : initialUser;

  return (
    <AuthContextProvider
      initialRole={initialRole}
      isClerkConfigured={true}
      clerkUser={clerkUser}
      skipRoleFetch={skipRoleFetch}
    >
      <ActiveTeamSync />
      {children}
    </AuthContextProvider>
  );
}

export default function AuthProvider({
  children,
  initialRole = "admin",
  publishableKey,
  initialUser = null,
  skipRoleFetch = false,
}: AuthProviderProps) {
  const resolvedKey = (publishableKey || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "").trim();
  const isClerkReady = Boolean(resolvedKey);

  if (isClerkReady) {
    return (
      <ClerkProvider
        publishableKey={resolvedKey}
        appearance={clerkAppearance}
        localization={teamLocalization}
        signInUrl={CLERK_PATHS.signIn}
        signUpUrl={CLERK_PATHS.signUp}
        signInFallbackRedirectUrl={CLERK_PATHS.afterSignIn}
        signUpFallbackRedirectUrl={CLERK_PATHS.subscribe}
        afterSignOutUrl={CLERK_PATHS.afterSignOut}
        taskUrls={{ "choose-organization": CLERK_PATHS.selectOrganization }}
      >
        <ClerkBridge initialRole={initialRole} initialUser={initialUser} skipRoleFetch={skipRoleFetch}>
          {children}
        </ClerkBridge>
      </ClerkProvider>
    );
  }

  return (
    <AuthContextProvider
      initialRole={initialRole}
      isClerkConfigured={false}
      clerkUser={initialUser}
      skipRoleFetch={skipRoleFetch}
    >
      {children}
    </AuthContextProvider>
  );
}

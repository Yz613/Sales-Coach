"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { apiPath } from "@/lib/utils";
import type { UserRole } from "./auth";
import {
  initialClientRoleMemory,
  reduceClientRole,
  type ClerkMembershipInput,
} from "./client-role";

export type { ClerkMembershipInput } from "./client-role";

interface AuthContextValue {
  role: UserRole;
  isAdmin: boolean;
  isMember: boolean;
  isClerkConfigured: boolean;
  user: {
    id?: string | null;
    email?: string;
    name?: string;
  } | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  role: "member",
  isAdmin: false,
  isMember: true,
  isClerkConfigured: false,
  user: null,
  isLoading: true,
});

export function useAppAuth() {
  return useContext(AuthContext);
}

function isUserRole(value: unknown): value is UserRole {
  return value === "admin" || value === "member";
}

export function AuthContextProvider({
  children,
  initialRole = "member",
  isClerkConfigured = false,
  clerkUser = null,
  skipRoleFetch = false,
  clerkMembership = null,
}: {
  children: React.ReactNode;
  initialRole?: UserRole;
  isClerkConfigured?: boolean;
  clerkUser?: { id?: string | null; email?: string; name?: string } | null;
  skipRoleFetch?: boolean;
  clerkMembership?: ClerkMembershipInput | null;
}) {
  const trustServerRole = !skipRoleFetch;
  const [memory, setMemory] = useState(() =>
    initialClientRoleMemory(initialRole, trustServerRole)
  );
  const reduced = reduceClientRole(memory, {
    initialRole,
    trustServerRole,
    clerkConfigured: isClerkConfigured,
    authLoaded: Boolean(clerkMembership?.authLoaded),
    orgLoaded: Boolean(clerkMembership?.orgLoaded),
    userId: clerkMembership?.userId ?? clerkUser?.id ?? null,
    orgRole: clerkMembership?.orgRole ?? null,
    hasOrgAdmin: Boolean(clerkMembership?.hasOrgAdmin),
  });
  if (
    reduced.memory.role !== memory.role ||
    reduced.memory.prevInitialRole !== memory.prevInitialRole ||
    reduced.memory.prevTrustServerRole !== memory.prevTrustServerRole ||
    reduced.memory.prevClerkRole !== memory.prevClerkRole
  ) {
    setMemory(reduced.memory);
  }

  const [user, setUser] = useState(clerkUser);
  const [fetchedRole, setFetchedRole] = useState<UserRole | null>(null);

  useEffect(() => {
    if (clerkUser?.id) {
      setUser(clerkUser);
    }
  }, [clerkUser]);

  useEffect(() => {
    setFetchedRole(null);
  }, [initialRole]);

  // Clerk membership drives the role when it is configured. This fetch only
  // covers local sessions that have no Clerk user yet.
  useEffect(() => {
    if (skipRoleFetch || isClerkConfigured || clerkUser?.id) return;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 5000);
    fetch(apiPath("/api/auth/role"), { signal: ac.signal })
      .then((res) => {
        const contentType = res.headers.get("content-type") || "";
        if (!res.ok || !contentType.includes("application/json")) return null;
        return res.json();
      })
      .then((data) => {
        if (isUserRole(data?.role)) {
          setFetchedRole(data.role);
        }
        if (data?.userId) {
          setUser({
            id: data.userId,
            email: data.email,
            name: data.name,
          });
        }
      })
      .catch((err) => console.warn("Failed to fetch current role:", err))
      .finally(() => clearTimeout(timer));
    return () => {
      clearTimeout(timer);
      ac.abort();
    };
  }, [skipRoleFetch, isClerkConfigured, clerkUser?.id]);

  const role = !isClerkConfigured && fetchedRole ? fetchedRole : reduced.role;
  const isLoading = reduced.isLoading;

  const value: AuthContextValue = {
    role,
    isAdmin: role === "admin" && !isLoading,
    isMember: role === "member" && !isLoading,
    isClerkConfigured,
    user,
    isLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

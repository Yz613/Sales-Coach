"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { UserRole } from "./auth";

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
  switchRole: (newRole: UserRole) => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  role: "admin",
  isAdmin: true,
  isMember: false,
  isClerkConfigured: false,
  user: null,
  switchRole: async () => {},
  isLoading: true,
});

export function useAppAuth() {
  return useContext(AuthContext);
}

export function AuthContextProvider({
  children,
  initialRole = "admin",
  isClerkConfigured = false,
  clerkUser = null,
}: {
  children: React.ReactNode;
  initialRole?: UserRole;
  isClerkConfigured?: boolean;
  clerkUser?: { id?: string | null; email?: string; name?: string } | null;
}) {
  const [role, setRole] = useState<UserRole>(initialRole);
  const [user, setUser] = useState(clerkUser);
  const [isLoading, setIsLoading] = useState(false);

  // Sync role from server cookie or API on initial mount
  useEffect(() => {
    fetch("/api/auth/role")
      .then((res) => res.json())
      .then((data) => {
        if (data.role) {
          setRole(data.role);
        }
        if (data.userId) {
          setUser({
            id: data.userId,
            email: data.email,
            name: data.name,
          });
        }
      })
      .catch((err) => console.warn("Failed to fetch current role:", err));
  }, []);

  const switchRole = useCallback(async (newRole: UserRole) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        setRole(newRole);
        // Refresh page to apply server-side role changes & redirections
        window.location.reload();
      }
    } catch (err) {
      console.error("Failed to switch role:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value: AuthContextValue = {
    role,
    isAdmin: role === "admin",
    isMember: role === "member",
    isClerkConfigured,
    user,
    switchRole,
    isLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

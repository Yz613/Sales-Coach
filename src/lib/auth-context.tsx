"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { apiPath } from "@/lib/utils";
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
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  role: "admin",
  isAdmin: true,
  isMember: false,
  isClerkConfigured: false,
  user: null,
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

  useEffect(() => {
    if (clerkUser?.id) {
      setUser(clerkUser);
    }
  }, [clerkUser]);

  useEffect(() => {
    fetch(apiPath("/api/auth/role"))
      .then((res) => {
        const contentType = res.headers.get("content-type") || "";
        if (!res.ok || !contentType.includes("application/json")) return null;
        return res.json();
      })
      .then((data) => {
        if (data?.role) {
          setRole(data.role);
        }
        if (data?.userId) {
          setUser({
            id: data.userId,
            email: data.email,
            name: data.name,
          });
        }
      })
      .catch((err) => console.warn("Failed to fetch current role:", err));
  }, []);

  const value: AuthContextValue = {
    role,
    isAdmin: role === "admin",
    isMember: role === "member",
    isClerkConfigured,
    user,
    isLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

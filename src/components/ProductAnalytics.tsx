"use client";

import { useEffect } from "react";
import { useAppAuth } from "@/lib/auth-context";
import { installFormTracking, installInputMask, startProductAnalytics, syncAccountAnalytics } from "@/lib/analytics-browser";

/** Identifies a signed-in account and records successful form submits. Renders nothing. */
export default function ProductAnalytics() {
  const { user } = useAppAuth();
  const accountId = user?.id ?? null;

  useEffect(() => {
    startProductAnalytics();
    installFormTracking();
    installInputMask();
  }, []);

  useEffect(() => {
    syncAccountAnalytics(accountId);
  }, [accountId]);

  return null;
}

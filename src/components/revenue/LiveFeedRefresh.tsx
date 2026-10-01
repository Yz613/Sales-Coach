"use client";
import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Radio } from "lucide-react";

/** Refresh server-rendered lists while visible, preserving search fields and client state. */
export default function LiveFeedRefresh({ enabled }: { enabled: boolean }) {
  const router = useRouter(); const [pending, startTransition] = useTransition();
  useEffect(() => {
    if (!enabled) return;
    const refresh = () => {
      if (pending || document.hidden || document.activeElement?.matches("input, textarea, select") || document.querySelector('[role="dialog"]')) return;
      startTransition(() => router.refresh());
    };
    const timer = setInterval(refresh, 10000);
    document.addEventListener("visibilitychange", refresh);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [enabled, pending, router]);
  return enabled ? <span className="mt-2 inline-flex items-center gap-1.5 text-xs text-[#86868b]"><Radio size={12} className="text-emerald-600" /> Updates automatically</span> : null;
}

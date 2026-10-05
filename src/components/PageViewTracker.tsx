"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { sendPageView } from "@/lib/page-views";

/** Sends a page view on the first paint and on later client navigations. */
export default function PageViewTracker() {
  const pathname = usePathname();
  const search = useSearchParams().toString();

  useEffect(() => {
    let sentHref = "";
    const report = () => {
      const href = window.location.href;
      if (href === sentHref) return;
      const sent = sendPageView(window.gtag, window.location, document.title);
      if (sent) sentHref = href;
    };
    report();
    const retry = () => report();
    if (typeof window.gtag !== "function") {
      window.addEventListener("load", retry, { once: true });
    }
    window.addEventListener("hashchange", report);
    return () => {
      window.removeEventListener("load", retry);
      window.removeEventListener("hashchange", report);
    };
  }, [pathname, search]);

  return null;
}

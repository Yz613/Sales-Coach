"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Navigation from "@/components/Navigation";
import {
  isCheckoutPath,
  isMarketingAppPath,
  isPublicAuthRoute,
  isPublicMarketingPath,
  isSubscribePath,
} from "@/lib/public-path";

export default function AppChrome({ children, initialPublicPath }: { children: React.ReactNode; initialPublicPath: string }) {
  const pathname = usePathname();
  // Full public path from the browser (`/app/...`). `usePathname()` is stripped
  // of `basePath`, so `/` means the dashboard — never treat that as marketing.
  // Hosted apex pages are rewritten onto /app/* while the browser keeps the
  // apex URL. Keep the first client render identical to the server's route.
  const [browserPath, setBrowserPath] = useState<string | null>(initialPublicPath || null);

  useEffect(() => {
    const sync = () => setBrowserPath(window.location.pathname);
    sync();
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", sync);
    };
  }, [pathname]);

  // Chrome can restore a backgrounded tab as an empty frame. A one-frame
  // opacity tick forces those layers to paint again.
  useEffect(() => {
    const repaint = () => {
      if (document.visibilityState !== "visible") return;
      const root = document.documentElement;
      root.style.opacity = "0.999";
      requestAnimationFrame(() => {
        root.style.opacity = "";
      });
    };
    document.addEventListener("visibilitychange", repaint);
    window.addEventListener("pageshow", repaint);
    return () => {
      document.removeEventListener("visibilitychange", repaint);
      window.removeEventListener("pageshow", repaint);
    };
  }, []);

  const chromeless =
    isMarketingAppPath(pathname) ||
    isPublicAuthRoute(pathname) ||
    isSubscribePath(pathname) ||
    isCheckoutPath(pathname) ||
    (browserPath != null &&
      (isMarketingAppPath(browserPath) ||
        isPublicMarketingPath(browserPath) ||
        isPublicAuthRoute(browserPath) ||
        isSubscribePath(browserPath) ||
        isCheckoutPath(browserPath)));

  if (chromeless) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] md:pl-[240px]">
      <Navigation />
      <main className="apple-content">{children}</main>
    </div>
  );
}

"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import Navigation from "@/components/Navigation";
import { isMarketingRoute } from "@/lib/public-path";

/**
 * App chrome (signed-in nav + padded shell) is skipped on the public
 * marketing page so `/` and `/app/home` can be full-bleed.
 */
export default function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const isMarketing = isMarketingRoute(pathname);

  if (isMarketing) {
    return <>{children}</>;
  }

  return (
    <>
      <Navigation />
      <main className="mx-auto max-w-[1600px] w-full px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </>
  );
}

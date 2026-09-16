"use client";

import { usePathname } from "next/navigation";
import Navigation from "@/components/Navigation";
import { isMarketingAppPath } from "@/lib/public-path";

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const marketing = isMarketingAppPath(pathname);

  if (marketing) {
    return <>{children}</>;
  }

  return (
    <>
      <Navigation />
      <main className="mx-auto max-w-[1600px] w-full px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </>
  );
}

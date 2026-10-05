import type { Metadata } from "next";
import MarketingShell from "@/components/MarketingShell";

export const metadata: Metadata = {
  title: "Page not found — Sales Coach",
  robots: { index: false, follow: false },
};

/**
 * Template for apex URLs the app does not serve. The worker fetches this page
 * and returns it with status 404. Rendering it directly keeps the HTML in the
 * document; `notFound()` would swap in Next's empty error shell.
 */
export default function MissingPage() {
  return (
    <MarketingShell>
      <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-20">
        <p className="text-[17px] font-medium text-[#007AFF]">404</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#1d1d1f]">This page does not exist.</h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-[#6e6e73]">
          The address may be mistyped, or the page may have been removed.
        </p>
        <a href="/" className="mt-6 inline-flex text-sm font-semibold text-[#0071E3] hover:text-[#0077ED]">
          Back to the home page
        </a>
      </main>
    </MarketingShell>
  );
}

import { headers } from "next/headers";
import MarketingShell from "@/components/MarketingShell";
import { isNotFoundPath } from "@/lib/public-path";

function NotFoundBody({ homeHref, homeLabel }: { homeHref: string; homeLabel: string }) {
  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-20">
      <p className="text-[17px] font-medium text-[#007AFF]">404</p>
      <h1 className="text-3xl font-semibold tracking-tight text-[#1d1d1f] mt-3">This page does not exist.</h1>
      <p className="mt-4 max-w-xl text-sm leading-relaxed text-[#6e6e73]">
        The address may be mistyped, or the page may have been removed.
      </p>
      <a href={homeHref} className="mt-6 inline-flex text-sm font-semibold text-[#0071E3] hover:text-[#0077ED]">
        {homeLabel}
      </a>
    </main>
  );
}

export default async function NotFound() {
  const path = (await headers()).get("x-salescoach-path") || "";
  if (isNotFoundPath(path)) {
    return (
      <MarketingShell>
        <NotFoundBody homeHref="/" homeLabel="Back to the home page" />
      </MarketingShell>
    );
  }
  return <NotFoundBody homeHref="/app" homeLabel="Back to the workspace" />;
}

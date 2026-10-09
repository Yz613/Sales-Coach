import type { ReactNode } from "react";
import { DEMO_SELF_HOST_HREF, DEMO_SIGN_UP_HREF } from "@/lib/demo/workspace";

export default function DemoFrame({
  children,
  callsHref = "/demo",
}: {
  children: ReactNode;
  callsHref?: string;
}) {
  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1d1d1f]">
      <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-[#F5F5F7]/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <a href={callsHref} className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[#007AFF] text-[11px] font-semibold text-white">
              SC
            </span>
            <span>
              <span className="block text-[13px] font-semibold tracking-tight">Sales Coach</span>
              <span className="block text-[11px] text-[#86868b]">Sample workspace</span>
            </span>
          </a>
          <nav className="flex flex-wrap items-center gap-2 text-xs font-medium">
            <a href="/demo" className="rounded-full px-3 py-1.5 text-[#3a3a3c] hover:bg-black/[0.05]">
              Sample calls
            </a>
            <a href={DEMO_SIGN_UP_HREF} className="rounded-full bg-[#007AFF] px-3 py-1.5 text-white hover:bg-[#0071E3]">
              Sign up
            </a>
            <a
              href={DEMO_SELF_HOST_HREF}
              className="rounded-full bg-white px-3 py-1.5 text-[#1d1d1f] shadow-[0_0_0_1px_rgba(0,0,0,0.08)] hover:bg-black/[0.03]"
            >
              Self-host
            </a>
          </nav>
        </div>
      </header>
      <div className="border-b border-amber-500/20 bg-amber-500/10">
        <p className="mx-auto max-w-5xl px-4 py-2.5 text-xs leading-relaxed text-[#3a3a3c] sm:px-6">
          Read-only sample. These calls, people, and companies are fictional. Re-score, comments, sharing, and model calls are turned off, so nothing here is saved.
        </p>
      </div>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}

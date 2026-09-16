"use client";

import { useState } from "react";
import Link from "next/link";
import { Github, Menu, X } from "lucide-react";
import { GITHUB_REPO_URL } from "@/lib/site";

const NAV_LINKS = [
  { href: "#features", label: "Coaching" },
  { href: "#paths", label: "Open source vs hosted" },
  { href: "#pricing", label: "Pricing" },
];

export default function MarketingHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#070a12]/80 backdrop-blur-2xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <a href="#main" className="flex items-center gap-2.5 group shrink-0">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 text-white text-xs font-bold shadow-md shadow-blue-500/25 border border-white/20 group-hover:scale-105 transition-transform">
            SC
          </span>
          <span className="font-semibold text-white tracking-tight text-sm sm:text-base">
            Sales Coach
          </span>
        </a>

        <nav className="hidden md:flex items-center gap-1" aria-label="Marketing">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-100 hover:bg-white/[0.04] transition"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/[0.08] transition"
          >
            <Github className="h-3.5 w-3.5" aria-hidden />
            View on GitHub
          </a>
          <Link
            href="/sign-in"
            className="rounded-xl px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white transition"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="inline-flex items-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 border border-white/10 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md shadow-blue-600/20 transition"
          >
            Get hosted access
          </Link>
        </div>

        <button
          type="button"
          className="md:hidden flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-slate-400 hover:text-white transition"
          aria-expanded={open}
          aria-controls="marketing-mobile-nav"
          onClick={() => setOpen((prev) => !prev)}
        >
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {open && (
        <div
          id="marketing-mobile-nav"
          className="md:hidden border-t border-white/[0.08] bg-slate-950/95 px-4 py-3 space-y-1 backdrop-blur-2xl"
        >
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/[0.05] hover:text-white"
            >
              {link.label}
            </a>
          ))}
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/[0.05]"
          >
            <Github className="h-4 w-4" aria-hidden />
            View on GitHub
          </a>
          <Link
            href="/sign-in"
            className="block rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/[0.05]"
            onClick={() => setOpen(false)}
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="block rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white text-center"
            onClick={() => setOpen(false)}
          >
            Get hosted access
          </Link>
        </div>
      )}
    </header>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import BrandMark from "@/components/BrandMark";

const links = [
  { href: "#how", label: "How it works" },
  { href: "#queue", label: "The queue" },
  { href: "#brief", label: "The brief" },
  { href: "#access", label: "Sign in" },
];

export default function LandingHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--rule)] bg-[var(--paper)]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <BrandMark />

        <nav className="hidden items-center gap-7 md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[13px] font-medium text-[var(--muted)] transition hover:text-[var(--ink)]"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/sign-in"
            className="hidden rounded-full border border-[var(--ink)] px-4 py-1.5 text-[13px] font-semibold text-[var(--ink)] transition hover:bg-[var(--ink)] hover:text-[var(--paper)] sm:inline-flex"
          >
            Sign in
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex rounded-full bg-[var(--rust)] px-4 py-1.5 text-[13px] font-semibold text-[var(--paper)] transition hover:bg-[#a42f14]"
          >
            Open the desk
          </Link>
          <button
            type="button"
            className="ml-1 inline-flex h-9 w-9 items-center justify-center border border-[var(--rule)] md:hidden"
            aria-label="Menu"
            onClick={() => setOpen((v) => !v)}
          >
            <span className="sr-only">Menu</span>
            <span className="flex flex-col gap-1.5">
              <span className="block h-px w-4 bg-[var(--ink)]" />
              <span className="block h-px w-4 bg-[var(--ink)]" />
            </span>
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-[var(--rule)] px-4 py-4 md:hidden">
          <div className="flex flex-col gap-3">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-[var(--ink)]"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}

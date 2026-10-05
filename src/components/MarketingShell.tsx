"use client";

import { useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";
import { CONTACT_EMAIL, GITHUB_REPO_URL, LICENSE_URL } from "@/lib/marketing";
import { toAppPath } from "@/lib/public-path";

const COMPANY_MARK_SRC = toAppPath("/refresh-queue-mark.svg");

type NavLink = {
  label: string;
  hash?: string;
  href?: string;
  external?: boolean;
};

const navLinks: NavLink[] = [
  { label: "Features", hash: "features" },
  { label: "How it works", hash: "how-it-works" },
  { label: "vs Gong", hash: "compare-gong" },
  { label: "Pricing", hash: "pricing" },
  { label: "Integrations", href: "/integrations" },
  { label: "GitHub", href: GITHUB_REPO_URL, external: true },
];

function linkHref(link: NavLink, onLanding: boolean): string {
  if (link.hash) return onLanding ? `#${link.hash}` : `/app/marketing#${link.hash}`;
  return link.href || "/";
}

function BrandMark() {
  return (
    <a href="/" className="flex items-center gap-2.5 group shrink-0">
      <img
        src={COMPANY_MARK_SRC}
        alt="Refresh Queue"
        width={32}
        height={32}
        className="h-8 w-8 shrink-0"
      />
      <span className="text-sm font-semibold tracking-tight text-[#1d1d1f]">Sales Coach</span>
    </a>
  );
}

export default function MarketingShell({
  children,
  onLanding = false,
  current,
}: {
  children: React.ReactNode;
  onLanding?: boolean;
  current?: "integrations";
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const itemClass = (link: NavLink, mobile: boolean) => {
    const active = current === "integrations" && link.href === "/integrations";
    if (mobile) {
      return active
        ? "block rounded-xl px-3 py-2 text-sm font-semibold text-[#1d1d1f] bg-black/[0.04]"
        : "block rounded-xl px-3 py-2 text-sm text-[#3a3a3c] hover:bg-black/[0.05]";
    }
    return active
      ? "px-3 py-1.5 rounded-xl text-xs font-semibold text-[#1d1d1f] bg-black/[0.04]"
      : "px-3 py-1.5 rounded-xl text-xs font-medium text-[#6e6e73] hover:bg-black/[0.04] hover:text-[#1d1d1f] transition";
  };

  return (
    <div className="relative min-h-screen">
      <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-[#F5F5F7]">
        <div className="mx-auto flex max-w-6xl w-full items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
          <BrandMark />
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) =>
              link.external ? (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={itemClass(link, false)}
                >
                  {link.label}
                </a>
              ) : (
                <a
                  key={link.label}
                  href={linkHref(link, onLanding)}
                  aria-current={current === "integrations" && link.href === "/integrations" ? "page" : undefined}
                  className={itemClass(link, false)}
                >
                  {link.label}
                </a>
              )
            )}
          </nav>
          <div className="hidden md:flex items-center gap-2">
            <a
              href="/app/sign-in"
              className="px-3 py-1.5 rounded-xl text-xs font-medium text-[#3a3a3c] hover:bg-black/[0.05] hover:text-[#1d1d1f] transition"
            >
              Sign in
            </a>
            <a
              href="/app"
              className="inline-flex items-center gap-1.5 rounded-full bg-[#007AFF] hover:bg-[#0071E3] text-white text-[13px] font-medium px-4 py-1.5 transition"
            >
              Open app
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
          <button
            type="button"
            className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-xl border border-black/[0.1] text-[#1d1d1f]"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
        {menuOpen && (
          <div className="md:hidden border-t border-black/[0.08] px-4 py-3 space-y-1 bg-white">
            {navLinks.map((link) =>
              link.external ? (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={itemClass(link, true)}
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </a>
              ) : (
                <a
                  key={link.label}
                  href={linkHref(link, onLanding)}
                  className={itemClass(link, true)}
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </a>
              )
            )}
            <a href="/app/sign-in" className="block rounded-xl px-3 py-2 text-sm text-[#3a3a3c] hover:bg-black/[0.05]" onClick={() => setMenuOpen(false)}>
              Sign in
            </a>
            <a
              href="/app"
              className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-white bg-[#007AFF] text-center"
              onClick={() => setMenuOpen(false)}
            >
              Open app
            </a>
          </div>
        )}
      </header>
      {children}
      <footer className="border-t border-black/[0.08]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
          <p className="text-xs leading-relaxed text-[#86868b]">
            <span className="text-[#6e6e73]">Sales Coach by Refresh Queue</span>
            <span className="mx-1.5" aria-hidden="true">·</span>
            © 2026 Refresh Queue. MIT License.
          </p>
          <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-[#6e6e73]">
            <a href="/integrations" className="hover:text-[#1d1d1f] transition" aria-current={current === "integrations" ? "page" : undefined}>
              Integrations
            </a>
            <a href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer" className="hover:text-[#1d1d1f] transition">
              GitHub
            </a>
            <a href={LICENSE_URL} target="_blank" rel="noopener noreferrer" className="hover:text-[#1d1d1f] transition">
              LICENSE
            </a>
            <a href="/app" className="hover:text-[#1d1d1f] transition">
              Open app
            </a>
            <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-[#1d1d1f] transition">
              {CONTACT_EMAIL}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to the RefreshQueue coaching desk.",
};

export default function SignInPage() {
  return (
    <section className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-4 py-20 sm:px-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
        Coaching desk
      </p>
      <h1 className="mt-3 font-serif text-4xl tracking-tight">Sign in to RefreshQueue</h1>
      <p className="mt-4 text-[var(--muted)] leading-relaxed">
        The Monday queue, the briefs, and the rep desk sit behind a login. Continue into your workspace to review this week’s calls.
      </p>
      <Link
        href="/dashboard"
        className="mt-8 inline-flex w-fit rounded-full bg-[var(--ink)] px-6 py-3 text-sm font-semibold text-[var(--paper)] transition hover:bg-black"
      >
        Continue to the coaching desk
      </Link>
      <p className="mt-6 text-sm text-[var(--muted)]">
        No public call data on this page.{" "}
        <Link href="/" className="underline decoration-[var(--rule)] underline-offset-4 hover:text-[var(--ink)]">
          Back to the site
        </Link>
      </p>
    </section>
  );
}

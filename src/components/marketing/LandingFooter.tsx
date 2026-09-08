import Link from "next/link";

export default function LandingFooter() {
  return (
    <footer className="border-t border-[var(--rule)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-end sm:justify-between sm:px-6">
        <div>
          <p className="font-serif text-lg text-[var(--ink)]">RefreshQueue</p>
          <p className="mt-1 max-w-sm text-sm text-[var(--muted)]">
            A Monday queue for the calls that leaked pipeline. The coaching desk is behind a login.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--muted)]">
          <a href="/#how" className="hover:text-[var(--ink)]">
            How it works
          </a>
          <Link href="/sign-in" className="hover:text-[var(--ink)]">
            Sign in
          </Link>
          <Link href="/dashboard" className="hover:text-[var(--ink)]">
            Open the desk
          </Link>
          <a href="mailto:hello@refreshqueue.com" className="hover:text-[var(--ink)]">
            hello@refreshqueue.com
          </a>
        </div>
      </div>
    </footer>
  );
}

"use client";

export default function ClerkGate({ children }: { children: React.ReactNode }) {
  const ready = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim());
  if (!ready) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 text-sm text-amber-200">
        Clerk is not configured in this environment. Set
        {" "}
        <code className="font-mono text-amber-100">NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code>
        {" "}
        and enable Organizations in the Clerk Dashboard to manage team workspaces.
      </div>
    );
  }
  return <>{children}</>;
}

import { SignUp } from "@clerk/nextjs";

export const dynamic = "force-dynamic";

export default function SignUpPage() {
  const hasClerk = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim());

  if (!hasClerk) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center text-sm text-slate-400">
        Authentication is not configured.
      </div>
    );
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      {/* Hash routing avoids Clerk path-sub-route miscomputation under the /app basePath. */}
      <SignUp routing="hash" />
    </div>
  );
}

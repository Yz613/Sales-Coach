import { SignIn } from "@clerk/nextjs";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      {/* Hash routing avoids Clerk path-sub-route miscomputation under the /app basePath. */}
      <SignIn routing="hash" />
    </div>
  );
}

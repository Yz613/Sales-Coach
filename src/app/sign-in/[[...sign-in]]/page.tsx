import { SignIn } from "@clerk/nextjs";
import ClerkAuthForm, { ClerkAuthFeedback } from "@/components/ClerkAuthForm";
import { hasClerkPublishableKey } from "@/lib/clerk-env";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  if (!hasClerkPublishableKey()) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center text-sm text-[#6e6e73]">
        Authentication is not configured.
      </div>
    );
  }

  return (
    <ClerkAuthForm>
      {/* Hash routing avoids Clerk path-sub-route miscomputation under the /app basePath. */}
      <SignIn routing="hash" fallback={<ClerkAuthFeedback />} />
    </ClerkAuthForm>
  );
}

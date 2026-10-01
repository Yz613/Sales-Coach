import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import ClerkAuthForm from "@/components/ClerkAuthForm";
import SignInForm from "@/components/SignInForm";
import { hasClerkPublishableKey, hasClerkServerAuth } from "@/lib/clerk-env";
import { signInDestination } from "@/lib/signInRedirect";
import { stripAppBasePath } from "@/lib/public-path";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  if (!hasClerkPublishableKey()) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center text-sm text-[#6e6e73]">
        Authentication is not configured.
      </div>
    );
  }

  // Read the verified middleware session only; do not wait on database/billing.
  let destination: string | null = null;
  if (hasClerkServerAuth()) {
    try {
      const session = await auth({ treatPendingAsSignedOut: false });
      if (session.userId) destination = signInDestination({ sessionStatus: session.sessionStatus });
    } catch {
      // The client can still load the form and recover an unavailable session.
    }
  }
  if (destination) redirect(stripAppBasePath(destination));

  return (
    <ClerkAuthForm>
      <SignInForm />
    </ClerkAuthForm>
  );
}

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignUp } from "@clerk/nextjs";
import { hostedBillingRequired } from "@/lib/billingAccess";
import { hasClerkPublishableKey } from "@/lib/clerk-env";
import {
  CHECKOUT_COOKIE,
  hasClerkInviteQuery,
  isPaidCheckoutSessionId,
} from "@/lib/stripeCheckout";

export const dynamic = "force-dynamic";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!hasClerkPublishableKey()) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center text-sm text-slate-400">
        Authentication is not configured.
      </div>
    );
  }

  const params = await searchParams;
  const invite = hasClerkInviteQuery(params);
  if (hostedBillingRequired() && !invite) {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(CHECKOUT_COOKIE)?.value || null;
    const paid = await isPaidCheckoutSessionId(sessionId);
    if (!paid) {
      redirect("/marketing#pricing");
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      {/* Hash routing avoids Clerk path-sub-route miscomputation under the /app basePath. */}
      <SignUp routing="hash" />
    </div>
  );
}

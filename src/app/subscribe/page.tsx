import { PricingTable } from "@clerk/nextjs";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerAuth } from "@/lib/auth";
import { CONTACT_MAILTO, PRICING_PLANS } from "@/lib/marketing";
import { hostedBillingRequired } from "@/lib/billingAccess";
import { toAppPath } from "@/lib/public-path";
import ClerkGate from "@/components/ClerkGate";
import { clerkAppearance, clerkUrl } from "@/lib/clerk-ui";

export const dynamic = "force-dynamic";

export default async function SubscribePage() {
  const auth = await getServerAuth();
  if (auth.isClerkConfigured && !auth.userId) {
    redirect(toAppPath("/sign-up"));
  }
  if (auth.isClerkConfigured && !auth.orgId) {
    redirect(toAppPath("/select-organization"));
  }
  if (auth.billingPaid || !hostedBillingRequired()) {
    redirect(toAppPath("/"));
  }

  const paidPlans = PRICING_PLANS.filter((plan) => plan.id !== "oss");

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <div className="text-center space-y-3 mb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">Hosted workspace</p>
        <h1 className="text-3xl sm:text-4xl font-bold text-white">Choose a plan to continue</h1>
        <p className="text-sm text-slate-400 max-w-2xl mx-auto leading-relaxed">
          New teams start empty and locked until checkout completes. You will not see another account&apos;s
          calls, transcripts, or API keys.
        </p>
      </div>

      <ClerkGate>
        <div className="rounded-3xl glass-card p-4 sm:p-8">
          <PricingTable
            for="organization"
            newSubscriptionRedirectUrl={clerkUrl("/")}
            appearance={clerkAppearance}
          />
        </div>
      </ClerkGate>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {paidPlans.map((plan) => (
          <article key={plan.id} className="rounded-2xl glass-card p-5">
            <p className="text-xs uppercase tracking-wider text-slate-400">{plan.name}</p>
            <p className="mt-2 text-2xl font-bold text-white">
              {plan.price}
              {plan.period && <span className="text-sm font-medium text-slate-400">{plan.period}</span>}
            </p>
            <p className="mt-2 text-sm text-slate-400">{plan.blurb}</p>
          </article>
        ))}
      </div>

      <p className="mt-8 text-center text-sm text-slate-500">
        Need Enterprise or a custom high-volume tier?{" "}
        <a href={CONTACT_MAILTO} className="text-blue-300 hover:text-blue-200">
          Talk to us
        </a>
        .{" "}
        <Link href="/" className="text-slate-400 hover:text-slate-200">
          Back to pricing
        </Link>
      </p>
    </div>
  );
}

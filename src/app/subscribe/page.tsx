import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerAuth } from "@/lib/auth";
import { CONTACT_MAILTO, PRICING_PLANS } from "@/lib/marketing";
import { hostedBillingRequired } from "@/lib/billingAccess";
import { toAppPath } from "@/lib/public-path";
import { claimPendingCheckout, hostedCheckoutPath, isPaidCheckoutSessionId, parseCheckoutPlan, readCheckoutCookie } from "@/lib/stripeCheckout";

export const dynamic = "force-dynamic";

export default async function SubscribePage() {
  const auth = await getServerAuth();
  const sessionId = await readCheckoutCookie();

  if (auth.isClerkConfigured && !auth.userId) {
    const paid = await isPaidCheckoutSessionId(sessionId);
    redirect(paid ? toAppPath("/sign-up") : "/marketing#pricing");
  }
  if (auth.isClerkConfigured && !auth.orgId) {
    redirect(toAppPath("/select-organization"));
  }

  if (auth.orgId) {
    await claimPendingCheckout({ orgId: auth.orgId, email: auth.email, sessionId });
  }

  const latest = await getServerAuth();
  if (latest.billingPaid || !hostedBillingRequired()) {
    redirect(toAppPath("/"));
  }

  const paidPlans = PRICING_PLANS.filter((plan) => plan.id === "coach" || plan.id === "team");

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <div className="text-center space-y-3 mb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">Hosted workspace</p>
        <h1 className="text-3xl sm:text-4xl font-bold text-white">Pay with Stripe to continue</h1>
        <p className="text-sm text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Checkout happens before you create an account. New teams start empty and locked until Stripe
          confirms payment. You will not see another account&apos;s calls, transcripts, or API keys.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {paidPlans.map((plan) => (
          <article key={plan.id} className="rounded-2xl glass-card p-6 flex flex-col">
            <p className="text-xs uppercase tracking-wider text-slate-400">{plan.name}</p>
            <p className="mt-2 text-2xl font-bold text-white">
              {plan.price}
              {plan.period && <span className="text-sm font-medium text-slate-400">{plan.period}</span>}
            </p>
            <p className="mt-2 text-sm text-slate-400 flex-1">{plan.blurb}</p>
            <a
              href={hostedCheckoutPath(parseCheckoutPlan(plan.id) || "coach")}
              className="mt-6 inline-flex items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2.5 border border-blue-400/20"
            >
              Pay with Stripe
            </a>
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

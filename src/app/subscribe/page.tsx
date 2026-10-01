import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerAuth, rereadServerAuth } from "@/lib/auth";
import { CONTACT_MAILTO, PRICING_PLANS } from "@/lib/marketing";
import { hostedBillingRequired } from "@/lib/billingAccess";
import { claimPendingCheckout, hostedCheckoutPath, isPaidCheckoutSessionId, parseCheckoutPlan, readCheckoutCookie } from "@/lib/stripeCheckout";

export const dynamic = "force-dynamic";

export default async function SubscribePage() {
  const auth = await getServerAuth();
  const sessionId = await readCheckoutCookie();

  if (auth.isClerkConfigured && !auth.userId) {
    const paid = await isPaidCheckoutSessionId(sessionId);
    redirect(paid ? "/sign-up" : "/marketing#pricing");
  }
  if (auth.isClerkConfigured && !auth.orgId) {
    redirect("/select-organization");
  }

  if (auth.orgId) {
    if (auth.isAdmin) await claimPendingCheckout({ orgId: auth.orgId, email: auth.email, sessionId });
  }

  const latest = await rereadServerAuth();
  if (latest.billingPaid || !hostedBillingRequired()) {
    redirect("/");
  }

  const paidPlans = PRICING_PLANS.filter((plan) => plan.id === "coach" || plan.id === "team");

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <Link href="/workspaces" className="mb-8 inline-flex text-sm font-semibold text-[#0071E3] hover:text-[#0077ED]">
        ← Back to main menu
      </Link>
      <div className="text-center space-y-3 mb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#007AFF]">Hosted workspace</p>
        <h1 className="text-3xl sm:text-4xl font-bold text-[#1d1d1f]">Choose a plan for this team</h1>
        <p className="text-sm text-[#6e6e73] max-w-2xl mx-auto leading-relaxed">
          Access is managed separately for each team. If you already have a paid account, return to
          the main menu and open your existing team. You do not need to pay again to use a team with access.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {paidPlans.map((plan) => (
          <article key={plan.id} className="rounded-2xl glass-card p-6 flex flex-col">
            <p className="text-xs uppercase tracking-wider text-[#6e6e73]">{plan.name}</p>
            <p className="mt-2 text-2xl font-bold text-[#1d1d1f]">
              {plan.price}
              {plan.period && <span className="text-sm font-medium text-[#6e6e73]">{plan.period}</span>}
            </p>
            <p className="mt-2 text-sm text-[#6e6e73] flex-1">{plan.blurb}</p>
            <a
              href={hostedCheckoutPath(parseCheckoutPlan(plan.id) || "coach")}
              className="mt-6 inline-flex items-center justify-center rounded-xl bg-[#007AFF] hover:bg-[#0071E3] text-white text-sm font-semibold px-4 py-2.5 border border-blue-400/20"
            >
              Pay with Stripe
            </a>
          </article>
        ))}
      </div>

      <p className="mt-8 text-center text-sm text-[#86868b]">
        Need Enterprise or a custom high-volume tier?{" "}
        <a href={CONTACT_MAILTO} className="text-[#0071E3] hover:text-[#0077ED]">
          Talk to us
        </a>
        .{" "}
        <Link href="/marketing#pricing" className="text-[#6e6e73] hover:text-[#1d1d1f]">
          Back to pricing
        </Link>
      </p>
    </div>
  );
}

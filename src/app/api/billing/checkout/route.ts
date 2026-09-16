import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/auth";
import { hostedBillingRequired } from "@/lib/billingAccess";
import {
  createStripeCheckoutSession,
  originFromRequest,
  parseCheckoutPlan,
} from "@/lib/stripeCheckout";
import { StripeRequestError } from "@/lib/stripe";

export const dynamic = "force-dynamic";

function pricingUrl(req: Request) {
  return new URL("/#pricing", originFromRequest(req));
}

async function startCheckout(req: Request) {
  const url = new URL(req.url);
  const planId = parseCheckoutPlan(url.searchParams.get("plan"));
  if (!planId) {
    return NextResponse.redirect(pricingUrl(req), 303);
  }

  try {
    let orgId: string | null = null;
    let email: string | null = null;
    try {
      const auth = await getServerAuth();
      if (auth.userId) {
        orgId = auth.orgId || null;
        email = auth.email || null;
      }
    } catch {
      // Anonymous checkout is the hosted sign-up path.
    }

    const session = await createStripeCheckoutSession({
      planId,
      origin: originFromRequest(req),
      orgId,
      email,
    });
    if (!session.url) {
      return NextResponse.json({ error: "Stripe did not return a checkout URL." }, { status: 502 });
    }
    return NextResponse.redirect(session.url, 303);
  } catch (err) {
    const status = err instanceof StripeRequestError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Unable to start Stripe checkout.";
    if (!hostedBillingRequired() && status === 503) {
      return NextResponse.redirect(pricingUrl(req), 303);
    }
    return NextResponse.json({ error: message, checkout: "/#pricing" }, { status: status >= 400 ? status : 500 });
  }
}

export async function GET(req: Request) {
  return startCheckout(req);
}

export async function POST(req: Request) {
  return startCheckout(req);
}

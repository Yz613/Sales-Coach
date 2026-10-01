import { withPublicApi } from "@/lib/workspace";
import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/auth";
import type { CheckoutFailureCode } from "@/lib/checkoutFailure";
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
      throw new StripeRequestError("Stripe did not return a checkout URL.", 502, "STRIPE_INVALID_RESPONSE");
    }
    return NextResponse.redirect(session.url, 303);
  } catch (err) {
    const stripeError = err instanceof StripeRequestError ? err : null;
    const code: CheckoutFailureCode = stripeError?.code === "STRIPE_NOT_CONFIGURED" ||
      stripeError?.providerStatus === 401 || stripeError?.providerStatus === 403 ? "configuration"
      : stripeError?.code === "STRIPE_UNAVAILABLE" ? "unavailable" : "failed";
    console.warn(JSON.stringify({
      event: "billing.checkout_failed", planId, code,
      errorType: err instanceof Error ? err.name : "UnknownError",
      providerStatus: stripeError?.providerStatus,
      providerCode: stripeError?.providerCode,
      providerParam: stripeError?.providerParam,
    }));
    const destination = pricingUrl(req);
    destination.searchParams.set("checkout_error", code);
    return NextResponse.redirect(destination, 303);
  }
}

async function GETHandler(req: Request) {
  return startCheckout(req);
}

async function POSTHandler(req: Request) {
  return startCheckout(req);
}

export const GET = withPublicApi(GETHandler, {});
export const POST = withPublicApi(POSTHandler, {});

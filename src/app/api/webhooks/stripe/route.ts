import { NextResponse } from "next/server";
import { applyStripeEvent } from "@/lib/stripeCheckout";
import { stripeWebhookSecret, verifyStripeSignature, type StripeEvent } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = stripeWebhookSecret();
  const payload = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!secret) {
    return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 503 });
  }
  if (!verifyStripeSignature(payload, signature, secret)) {
    return NextResponse.json({ error: "Invalid Stripe signature." }, { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(payload) as StripeEvent;
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  try {
    const result = await applyStripeEvent(event);
    return NextResponse.json({ received: true, handled: result.handled, sessionId: result.sessionId || null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook handler failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

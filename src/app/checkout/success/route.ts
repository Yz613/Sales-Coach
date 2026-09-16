import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/auth";
import { toAppPath } from "@/lib/public-path";
import {
  CHECKOUT_COOKIE,
  checkoutCookieOptions,
  claimPendingCheckout,
  finalizeCheckoutSession,
  originFromRequest,
} from "@/lib/stripeCheckout";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = originFromRequest(req);
  const sessionId = (url.searchParams.get("session_id") || "").trim();
  if (!sessionId) {
    return NextResponse.redirect(new URL("/#pricing", origin), 303);
  }

  let paid = false;
  try {
    const record = await finalizeCheckoutSession(sessionId);
    paid = record?.status === "paid";
  } catch (err) {
    console.warn("Stripe checkout finalize failed:", err);
  }

  if (!paid) {
    return NextResponse.redirect(new URL("/#pricing", origin), 303);
  }

  let nextPath = toAppPath("/sign-up");
  try {
    const auth = await getServerAuth();
    if (auth.userId && auth.orgId) {
      await claimPendingCheckout({ orgId: auth.orgId, email: auth.email, sessionId });
      nextPath = toAppPath("/");
    } else if (auth.userId) {
      nextPath = toAppPath("/select-organization");
    }
  } catch {
    nextPath = toAppPath("/sign-up");
  }

  const response = NextResponse.redirect(new URL(nextPath, origin), 303);
  response.cookies.set(CHECKOUT_COOKIE, sessionId, checkoutCookieOptions());
  return response;
}

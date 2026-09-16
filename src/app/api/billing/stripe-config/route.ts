import { NextResponse } from "next/server";
import { configureStoredStripeSecret, resolveStripeSecret, StripeRequestError } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function GET() {
  const configured = Boolean(await resolveStripeSecret());
  return NextResponse.json({ configured });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { secret?: unknown; stripeSecretKey?: unknown };
    const secret = String(body.secret || body.stripeSecretKey || "").trim();
    const result = await configureStoredStripeSecret(secret);
    return NextResponse.json({ configured: true, accountId: result.accountId });
  } catch (err) {
    const status = err instanceof StripeRequestError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Unable to store Stripe secret.";
    return NextResponse.json({ error: message }, { status: status >= 400 ? status : 500 });
  }
}

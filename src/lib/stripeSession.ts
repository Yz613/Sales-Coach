export type StripeCheckoutSession = {
  id: string;
  object?: string;
  status?: string | null;
  payment_status?: string | null;
  url?: string | null;
  customer?: string | { id: string } | null;
  customer_email?: string | null;
  customer_details?: { email?: string | null } | null;
  subscription?: string | { id: string } | null;
  metadata?: Record<string, string> | null;
};

export type StripeSubscription = {
  id: string;
  status?: string | null;
  customer?: string | { id: string } | null;
  metadata?: Record<string, string> | null;
};

export type StripeEvent = {
  id?: string;
  type: string;
  data?: { object?: Record<string, unknown> };
};

export function stripeCustomerId(
  customer: string | { id: string } | null | undefined
): string | null {
  if (!customer) return null;
  if (typeof customer === "string") return customer;
  return customer.id || null;
}

export function stripeSubscriptionId(
  subscription: string | { id: string } | null | undefined
): string | null {
  if (!subscription) return null;
  if (typeof subscription === "string") return subscription;
  return subscription.id || null;
}

export function stripeCustomerEmail(session: StripeCheckoutSession): string | null {
  return session.customer_details?.email || session.customer_email || null;
}

export function isPaidCheckoutSession(
  session: Pick<StripeCheckoutSession, "status" | "payment_status">
): boolean {
  const status = (session.status || "").toLowerCase();
  const payment = (session.payment_status || "").toLowerCase();
  if (status !== "complete") return false;
  return payment === "paid" || payment === "no_payment_required";
}

export function isActiveStripeSubscription(status: string | null | undefined): boolean {
  const normalized = (status || "").toLowerCase();
  return normalized === "active" || normalized === "trialing" || normalized === "past_due";
}

export function stripeSecret(env: Record<string, string | undefined> = process.env): string {
  return (env.STRIPE_SECRET_KEY || "").trim();
}

import { HOSTED_PLANS, parseHostedPlanId, type HostedPlanId } from "@/lib/billing";
import { activateHostedPlan, revokeHostedPlan } from "@/lib/billingQuota";
import { getGlobalSetting, setGlobalSetting } from "@/lib/db/service";
import { toAppPath } from "@/lib/public-path";
import { runWithTenant } from "@/lib/tenant";
import {
  isActiveStripeSubscription,
  isPaidCheckoutSession,
  stripeCustomerEmail,
  stripeCustomerId,
  stripeRequest,
  stripeSecret,
  stripeSubscriptionId,
  type StripeCheckoutSession,
  type StripeEvent,
  type StripeSubscription,
} from "@/lib/stripe";

export const CHECKOUT_COOKIE = "sc_checkout_session";
export const CHECKOUT_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
export const STRIPE_CHECKOUT_PLANS = ["coach", "team"] as const;

export type StripeCheckoutPlanId = (typeof STRIPE_CHECKOUT_PLANS)[number];

export type StripeCheckoutRecord = {
  sessionId: string;
  planId: StripeCheckoutPlanId;
  status: "paid" | "unpaid" | "canceled";
  email?: string | null;
  customerId?: string | null;
  subscriptionId?: string | null;
  claimedOrgId?: string | null;
  updatedAt: string;
};

export function isStripeCheckoutPlanId(value: string | null | undefined): value is StripeCheckoutPlanId {
  return value === "coach" || value === "team";
}

export function parseCheckoutPlan(value: string | null | undefined): StripeCheckoutPlanId | null {
  const parsed = parseHostedPlanId(value);
  return isStripeCheckoutPlanId(parsed) ? parsed : null;
}

export function hostedCheckoutPath(planId: StripeCheckoutPlanId): string {
  return `${toAppPath("/api/billing/checkout")}?plan=${planId}`;
}

export function checkoutCookieOptions() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: CHECKOUT_COOKIE_MAX_AGE,
  };
}

export function originFromRequest(req: Request): string {
  const url = new URL(req.url);
  const forwardedHost = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").split(",")[0]?.trim();
  const forwardedProto = (req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "")).split(",")[0]?.trim();
  if (forwardedHost) return `${forwardedProto || "https"}://${forwardedHost}`;
  return url.origin;
}

export function checkoutRedirectUrls(origin: string): { successUrl: string; cancelUrl: string } {
  return {
    successUrl: `${origin}${toAppPath("/checkout/success")}?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${origin}/#pricing`,
  };
}

export function checkoutLineItemFields(
  planId: StripeCheckoutPlanId,
  env: Record<string, string | undefined> = process.env
): Record<string, string> {
  const plan = HOSTED_PLANS[planId];
  const priceId = (planId === "coach" ? env.STRIPE_PRICE_COACH : env.STRIPE_PRICE_TEAM)?.trim();
  if (priceId) {
    return {
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
    };
  }
  return {
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(Math.round(plan.monthlyPriceUsd * 100)),
    "line_items[0][price_data][recurring][interval]": "month",
    "line_items[0][price_data][product_data][name]": plan.name,
    "line_items[0][price_data][product_data][description]": `${plan.monthlyEvals} call evaluations / month`,
  };
}

export function buildCheckoutSessionParams(input: {
  planId: StripeCheckoutPlanId;
  origin: string;
  orgId?: string | null;
  email?: string | null;
  env?: Record<string, string | undefined>;
}): Record<string, string> {
  const urls = checkoutRedirectUrls(input.origin);
  const params: Record<string, string> = {
    mode: "subscription",
    success_url: urls.successUrl,
    cancel_url: urls.cancelUrl,
    allow_promotion_codes: "true",
    "metadata[plan]": input.planId,
    "metadata[source]": "hosted_signup",
    "subscription_data[metadata][plan]": input.planId,
    "subscription_data[metadata][source]": "hosted_signup",
    ...checkoutLineItemFields(input.planId, input.env),
  };
  if (input.orgId) {
    params.client_reference_id = input.orgId;
    params["metadata[org_id]"] = input.orgId;
    params["subscription_data[metadata][org_id]"] = input.orgId;
  }
  if (input.email) {
    params.customer_email = input.email;
  }
  return params;
}

function sessionKey(sessionId: string) {
  return `stripe:session:${sessionId}`;
}

function emailKey(email: string) {
  return `stripe:email:${email.trim().toLowerCase()}`;
}

function subscriptionKey(subscriptionId: string) {
  return `stripe:subscription:${subscriptionId}`;
}

function customerKey(customerId: string) {
  return `stripe:customer:${customerId}`;
}

export function parseCheckoutRecord(raw: string | null): StripeCheckoutRecord | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StripeCheckoutRecord>;
    const planId = parseCheckoutPlan(parsed.planId);
    if (!parsed.sessionId || !planId) return null;
    const status = parsed.status === "paid" || parsed.status === "canceled" ? parsed.status : "unpaid";
    return {
      sessionId: parsed.sessionId,
      planId,
      status,
      email: parsed.email || null,
      customerId: parsed.customerId || null,
      subscriptionId: parsed.subscriptionId || null,
      claimedOrgId: parsed.claimedOrgId || null,
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function loadCheckoutRecord(sessionId: string): Promise<StripeCheckoutRecord | null> {
  const id = (sessionId || "").trim();
  if (!id) return null;
  return parseCheckoutRecord(await getGlobalSetting(sessionKey(id)));
}

async function writeCheckoutRecord(record: StripeCheckoutRecord): Promise<void> {
  await setGlobalSetting(sessionKey(record.sessionId), JSON.stringify(record));
  if (record.email) await setGlobalSetting(emailKey(record.email), record.sessionId);
  if (record.subscriptionId) await setGlobalSetting(subscriptionKey(record.subscriptionId), record.sessionId);
  if (record.customerId) await setGlobalSetting(customerKey(record.customerId), record.sessionId);
}

export function recordFromStripeSession(
  session: StripeCheckoutSession,
  previous?: StripeCheckoutRecord | null
): StripeCheckoutRecord | null {
  const planId =
    parseCheckoutPlan(session.metadata?.plan) ||
    previous?.planId ||
    null;
  if (!planId) return null;
  const paid = isPaidCheckoutSession(session);
  return {
    sessionId: session.id,
    planId,
    status: paid ? "paid" : session.status === "expired" ? "canceled" : "unpaid",
    email: stripeCustomerEmail(session) || previous?.email || null,
    customerId: stripeCustomerId(session.customer) || previous?.customerId || null,
    subscriptionId: stripeSubscriptionId(session.subscription) || previous?.subscriptionId || null,
    claimedOrgId: previous?.claimedOrgId || session.metadata?.org_id || null,
    updatedAt: new Date().toISOString(),
  };
}

export async function persistStripeSession(
  session: StripeCheckoutSession,
  previous?: StripeCheckoutRecord | null
): Promise<StripeCheckoutRecord | null> {
  const existing = previous ?? (await loadCheckoutRecord(session.id));
  const record = recordFromStripeSession(session, existing);
  if (!record) return existing || null;
  if (existing?.claimedOrgId && !record.claimedOrgId) {
    record.claimedOrgId = existing.claimedOrgId;
  }
  await writeCheckoutRecord(record);
  return record;
}

export async function finalizeCheckoutSession(sessionId: string): Promise<StripeCheckoutRecord | null> {
  const existing = await loadCheckoutRecord(sessionId);
  if (existing?.status === "paid") return existing;
  if (!stripeSecret()) return existing;
  const session = await stripeRequest<StripeCheckoutSession>("GET", `/checkout/sessions/${encodeURIComponent(sessionId)}`);
  return persistStripeSession(session, existing);
}

export async function isPaidCheckoutSessionId(sessionId: string | null | undefined): Promise<boolean> {
  const id = (sessionId || "").trim();
  if (!id) return false;
  const record = await finalizeCheckoutSession(id).catch(async () => loadCheckoutRecord(id));
  return record?.status === "paid";
}

export function firstSearchParam(
  params: Record<string, string | string[] | undefined> | URLSearchParams,
  key: string
): string | null {
  if (params instanceof URLSearchParams) {
    return params.get(key);
  }
  const value = params[key];
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

export function hasClerkInviteQuery(
  params: Record<string, string | string[] | undefined> | URLSearchParams
): boolean {
  return Boolean(firstSearchParam(params, "__clerk_ticket"));
}

export async function readCheckoutCookie(): Promise<string | null> {
  try {
    const { cookies } = await import("next/headers");
    return (await cookies()).get(CHECKOUT_COOKIE)?.value?.trim() || null;
  } catch {
    return null;
  }
}

async function resolveCheckoutSessionId(input: {
  email?: string | null;
  sessionId?: string | null;
}): Promise<string | null> {
  if (input.sessionId?.trim()) return input.sessionId.trim();
  const cookieId = await readCheckoutCookie();
  if (cookieId) return cookieId;
  const email = input.email?.trim().toLowerCase();
  if (!email) return null;
  return (await getGlobalSetting(emailKey(email)))?.trim() || null;
}

export async function claimPendingCheckout(input: {
  orgId: string;
  email?: string | null;
  sessionId?: string | null;
}): Promise<HostedPlanId | null> {
  const orgId = (input.orgId || "").trim();
  if (!orgId) return null;
  const sessionId = await resolveCheckoutSessionId(input);
  if (!sessionId) return null;
  const record = (await finalizeCheckoutSession(sessionId).catch(() => loadCheckoutRecord(sessionId))) || null;
  if (!record || record.status !== "paid") return null;
  if (record.claimedOrgId && record.claimedOrgId !== orgId) return null;
  await runWithTenant(orgId, () => activateHostedPlan(record.planId));
  record.claimedOrgId = orgId;
  record.updatedAt = new Date().toISOString();
  await writeCheckoutRecord(record);
  return record.planId;
}

async function loadRecordBySubscription(subscriptionId: string | null): Promise<StripeCheckoutRecord | null> {
  const id = (subscriptionId || "").trim();
  if (!id) return null;
  const sessionId = (await getGlobalSetting(subscriptionKey(id)))?.trim();
  if (!sessionId) return null;
  return loadCheckoutRecord(sessionId);
}

async function revokeClaimedOrg(record: StripeCheckoutRecord): Promise<void> {
  record.status = "canceled";
  record.updatedAt = new Date().toISOString();
  await writeCheckoutRecord(record);
  if (record.claimedOrgId) {
    await runWithTenant(record.claimedOrgId, () => revokeHostedPlan());
  }
}

export async function applyStripeEvent(event: StripeEvent): Promise<{ handled: boolean; sessionId?: string }> {
  const object = (event.data?.object || {}) as Record<string, unknown>;
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = object as unknown as StripeCheckoutSession;
    if (!session?.id) return { handled: false };
    const record = await persistStripeSession(session);
    const orgId = session.metadata?.org_id || record?.claimedOrgId;
    if (record?.status === "paid" && orgId) {
      await claimPendingCheckout({ orgId, sessionId: session.id, email: record.email });
    }
    return { handled: true, sessionId: session.id };
  }
  if (event.type === "customer.subscription.deleted") {
    const subscription = object as unknown as StripeSubscription;
    const record = await loadRecordBySubscription(subscription.id);
    if (record) await revokeClaimedOrg(record);
    return { handled: true, sessionId: record?.sessionId };
  }
  if (event.type === "customer.subscription.updated") {
    const subscription = object as unknown as StripeSubscription;
    const record = await loadRecordBySubscription(subscription.id);
    if (!record) return { handled: true };
    if (!isActiveStripeSubscription(subscription.status)) {
      await revokeClaimedOrg(record);
    }
    return { handled: true, sessionId: record.sessionId };
  }
  return { handled: false };
}

export async function createStripeCheckoutSession(input: {
  planId: StripeCheckoutPlanId;
  origin: string;
  orgId?: string | null;
  email?: string | null;
}): Promise<StripeCheckoutSession> {
  return stripeRequest<StripeCheckoutSession>(
    "POST",
    "/checkout/sessions",
    buildCheckoutSessionParams(input)
  );
}

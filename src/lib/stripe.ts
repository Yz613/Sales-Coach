import { createHmac, timingSafeEqual } from "node:crypto";
import {
  runtimeSecret,
  resolveStripeSecret,
  stripeSecretLooksValid,
  STRIPE_SECRET_SETTING_KEY,
} from "@/lib/stripeSession";

export const STRIPE_API_BASE = "https://api.stripe.com/v1";

export {
  type StripeCheckoutSession,
  type StripeSubscription,
  type StripeEvent,
  stripeCustomerId,
  stripeSubscriptionId,
  stripeCustomerEmail,
  isPaidCheckoutSession,
  isActiveStripeSubscription,
  stripeSecret,
  resolveStripeSecret,
  stripeSecretLooksValid,
  STRIPE_SECRET_SETTING_KEY,
} from "@/lib/stripeSession";

export class StripeRequestError extends Error {
  status: number;
  code: string;
  providerStatus?: number;
  providerCode?: string;
  providerParam?: string;

  constructor(message: string, status = 502, code = "STRIPE_REQUEST_FAILED") {
    super(message);
    this.name = "StripeRequestError";
    this.status = status;
    this.code = code;
  }
}

export function stripeWebhookSecret(env: Record<string, string | undefined> = process.env): string {
  return runtimeSecret("STRIPE_WEBHOOK_SECRET", env);
}

export function encodeStripeForm(params: Record<string, string>): string {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") body.append(key, value);
  }
  return body.toString();
}

export async function stripeRequest<T>(
  method: "GET" | "POST",
  path: string,
  params?: Record<string, string>,
  env: Record<string, string | undefined> = process.env,
  secretOverride?: string
): Promise<T> {
  const key = (secretOverride || "").trim() || (await resolveStripeSecret(env));
  if (!key) {
    throw new StripeRequestError("STRIPE_SECRET_KEY is not configured", 503, "STRIPE_NOT_CONFIGURED");
  }
  const url = new URL(`${STRIPE_API_BASE}${path.startsWith("/") ? path : `/${path}`}`);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
  };
  let body: string | undefined;
  if (method === "GET") {
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v) url.searchParams.set(k, v);
      }
    }
  } else {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = encodeStripeForm(params || {});
  }
  let res: Response;
  try {
    // Workers supports follow/manual only. Manual also keeps credentials off redirect destinations.
    res = await fetch(url, { method, headers, body, redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(25000) });
  } catch {
    throw new StripeRequestError("The payment provider is unavailable. Please try again shortly.", 502, "STRIPE_UNAVAILABLE");
  }
  const json = (await res.json().catch(() => ({}))) as {
    error?: { code?: string; param?: string };
  } & T;
  if (!res.ok) {
    const error = new StripeRequestError(`Payment provider request failed (${res.status}).`, 502, "STRIPE_REJECTED");
    error.providerStatus = res.status;
    // Provider messages may contain credentials or buyer details. Retain only bounded diagnostic codes.
    if (typeof json.error?.code === "string" && /^[a-z_]{1,80}$/.test(json.error.code)) error.providerCode = json.error.code;
    if (typeof json.error?.param === "string" && /^[a-z0-9_\[\]]{1,100}$/.test(json.error.param)) error.providerParam = json.error.param;
    throw error;
  }
  return json;
}

export async function verifyStripeSecretKey(secret: string): Promise<{ accountId: string }> {
  const trimmed = secret.trim();
  if (!stripeSecretLooksValid(trimmed)) {
    throw new StripeRequestError("Invalid Stripe secret key", 400);
  }
  const account = await stripeRequest<{ id?: string }>("GET", "/account", undefined, process.env, trimmed);
  const accountId = (account.id || "").trim();
  if (!accountId) {
    throw new StripeRequestError("Stripe account lookup failed", 502);
  }
  return { accountId };
}

export async function configureStoredStripeSecret(
  secret: string,
  options: {
    resolve?: (env?: Record<string, string | undefined>) => Promise<string>;
    verify?: (secret: string) => Promise<{ accountId: string }>;
    store?: (key: string, value: string) => Promise<void>;
  } = {}
): Promise<{ configured: true; accountId: string }> {
  const trimmed = (secret || "").trim();
  if (!stripeSecretLooksValid(trimmed)) {
    throw new StripeRequestError("Invalid Stripe secret key", 400);
  }
  const resolve = options.resolve || resolveStripeSecret;
  if (await resolve()) {
    throw new StripeRequestError("Stripe secret is already configured", 409);
  }
  const verify = options.verify || verifyStripeSecretKey;
  const { accountId } = await verify(trimmed);
  const store =
    options.store ||
    (async (key: string, value: string) => {
      const { setGlobalSetting } = await import("@/lib/db/service");
      await setGlobalSetting(key, value);
    });
  await store(STRIPE_SECRET_SETTING_KEY, trimmed);
  return { configured: true, accountId };
}

export function parseStripeSignatureHeader(header: string | null | undefined): {
  timestamp: string | null;
  signatures: string[];
} {
  const signatures: string[] = [];
  let timestamp: string | null = null;
  for (const part of (header || "").split(",")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    if (key === "t") timestamp = value;
    if (key === "v1" && value) signatures.push(value);
  }
  return { timestamp, signatures };
}

export function verifyStripeSignature(
  payload: string,
  header: string | null | undefined,
  secret: string,
  options: { toleranceSec?: number; nowMs?: number } = {}
): boolean {
  if (!payload || !header || !secret) return false;
  const { timestamp, signatures } = parseStripeSignatureHeader(header);
  if (!timestamp || signatures.length === 0) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const nowMs = options.nowMs ?? Date.now();
  const tolerance = options.toleranceSec ?? 300;
  if (Math.abs(nowMs / 1000 - ts) > tolerance) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  return signatures.some((signature) => {
    const got = Buffer.from(signature, "utf8");
    return got.length === expectedBuf.length && timingSafeEqual(got, expectedBuf);
  });
}

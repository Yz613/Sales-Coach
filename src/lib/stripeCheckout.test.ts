import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  encodeStripeForm,
  isActiveStripeSubscription,
  isPaidCheckoutSession,
  parseStripeSignatureHeader,
  stripeCustomerEmail,
  stripeCustomerId,
  verifyStripeSignature,
} from "./stripe";
import {
  buildCheckoutSessionParams,
  checkoutLineItemFields,
  checkoutRedirectUrls,
  hasClerkInviteQuery,
  hostedCheckoutPath,
  parseCheckoutPlan,
  parseCheckoutRecord,
  recordFromStripeSession,
} from "./stripeCheckout";
import { configureStoredStripeSecret, StripeRequestError } from "./stripe";
import { resolveStripeSecret, stripeSecret, stripeSecretLooksValid } from "./stripeSession";

describe("parseCheckoutPlan", () => {
  it("accepts only Coach and Team for self-serve Stripe", () => {
    assert.equal(parseCheckoutPlan("coach"), "coach");
    assert.equal(parseCheckoutPlan("hosted_team"), "team");
    assert.equal(parseCheckoutPlan("enterprise"), null);
    assert.equal(parseCheckoutPlan("oss"), null);
    assert.equal(hostedCheckoutPath("coach"), "/app/api/billing/checkout?plan=coach");
    assert.equal(hostedCheckoutPath("team"), "/app/api/billing/checkout?plan=team");
  });
});

describe("Stripe checkout params", () => {
  it("builds a subscription session that returns to Clerk only after payment", () => {
    const urls = checkoutRedirectUrls("https://refreshqueue.com");
    assert.equal(
      urls.successUrl,
      "https://refreshqueue.com/app/checkout/success?session_id={CHECKOUT_SESSION_ID}"
    );
    assert.equal(urls.cancelUrl, "https://refreshqueue.com/#pricing");

    const params = buildCheckoutSessionParams({
      planId: "coach",
      origin: "https://refreshqueue.com",
      env: {},
    });
    assert.equal(params.mode, "subscription");
    assert.equal(params["metadata[plan]"], "coach");
    assert.equal(params["line_items[0][price_data][unit_amount]"], "24900");
    assert.equal(params["line_items[0][price_data][recurring][interval]"], "month");
    assert.equal(params.success_url, urls.successUrl);
    assert.equal(params.customer_email, undefined);
    assert.equal(params.client_reference_id, undefined);
  });

  it("prefers configured Stripe price ids and attaches the paying org when present", () => {
    const fields = checkoutLineItemFields("team", { STRIPE_PRICE_TEAM: "price_team_123" });
    assert.equal(fields["line_items[0][price]"], "price_team_123");
    assert.equal(fields["line_items[0][price_data][unit_amount]"], undefined);

    const params = buildCheckoutSessionParams({
      planId: "team",
      origin: "https://example.com",
      orgId: "org_paid",
      email: "buyer@example.com",
      env: { STRIPE_PRICE_TEAM: "price_team_123" },
    });
    assert.equal(params["line_items[0][price]"], "price_team_123");
    assert.equal(params.client_reference_id, "org_paid");
    assert.equal(params["metadata[org_id]"], "org_paid");
    assert.equal(params.customer_email, "buyer@example.com");
  });
});

describe("Stripe signatures", () => {
  it("accepts a valid v1 signature within the tolerance window", () => {
    const secret = "whsec_test";
    const payload = JSON.stringify({ id: "evt_1", type: "checkout.session.completed" });
    const timestamp = "1700000000";
    const signature = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
    assert.equal(
      verifyStripeSignature(payload, `t=${timestamp},v1=${signature}`, secret, {
        nowMs: 1700000000 * 1000,
      }),
      true
    );
    assert.equal(
      verifyStripeSignature(payload, `t=${timestamp},v1=deadbeef`, secret, {
        nowMs: 1700000000 * 1000,
      }),
      false
    );
    assert.equal(
      verifyStripeSignature(payload, `t=${timestamp},v1=${signature}`, secret, {
        nowMs: (1700000000 + 400) * 1000,
      }),
      false
    );
    assert.deepEqual(parseStripeSignatureHeader(`t=${timestamp},v1=${signature},v0=old`), {
      timestamp,
      signatures: [signature],
    });
    assert.equal(encodeStripeForm({ "metadata[plan]": "coach" }), "metadata%5Bplan%5D=coach");
  });
});

describe("paid session detection", () => {
  it("treats complete + paid checkout sessions as the gate before Clerk", () => {
    assert.equal(isPaidCheckoutSession({ status: "complete", payment_status: "paid" }), true);
    assert.equal(isPaidCheckoutSession({ status: "open", payment_status: "unpaid" }), false);
    assert.equal(isPaidCheckoutSession({ status: "complete", payment_status: "unpaid" }), false);
    assert.equal(isActiveStripeSubscription("active"), true);
    assert.equal(isActiveStripeSubscription("canceled"), false);
    assert.equal(hasClerkInviteQuery({ __clerk_ticket: "abc" }), true);
    assert.equal(hasClerkInviteQuery({}), false);

    const record = recordFromStripeSession({
      id: "cs_test",
      status: "complete",
      payment_status: "paid",
      customer: "cus_123",
      customer_details: { email: "paid@example.com" },
      subscription: "sub_123",
      metadata: { plan: "team" },
    });
    assert.equal(record?.status, "paid");
    assert.equal(record?.planId, "team");
    assert.equal(record?.email, "paid@example.com");
    assert.equal(stripeCustomerId("cus_123"), "cus_123");
    assert.equal(stripeCustomerEmail({ id: "cs_test", customer_email: "a@b.com" }), "a@b.com");
    assert.equal(parseCheckoutRecord(JSON.stringify(record))?.sessionId, "cs_test");
  });
});

describe("stripeSecret", () => {
  it("reads STRIPE_SECRET_KEY from the provided env and ignores blanks", () => {
    assert.equal(stripeSecret({}), "");
    assert.equal(stripeSecret({ STRIPE_SECRET_KEY: "  " }), "");
    assert.equal(stripeSecret({ STRIPE_SECRET_KEY: " sk_live_abc " }), "sk_live_abc");
  });

  it("accepts live and test secret prefixes and prefers env over stored values", async () => {
    assert.equal(stripeSecretLooksValid("sk_live_abcdefghijklmnopqrstuv"), true);
    assert.equal(stripeSecretLooksValid("sk_test_abcdefghijklmnopqrstuv"), true);
    assert.equal(stripeSecretLooksValid("pk_live_abcdefghijklmnopqrstuv"), false);
    assert.equal(stripeSecretLooksValid("not-a-key"), false);
    assert.equal(
      await resolveStripeSecret({ STRIPE_SECRET_KEY: "sk_live_from_env_value1" }, async () => "sk_live_from_store"),
      "sk_live_from_env_value1"
    );
    assert.equal(await resolveStripeSecret({}, async () => " sk_live_from_store "), "sk_live_from_store");
    assert.equal(await resolveStripeSecret({}, async () => {
      throw new Error("db down");
    }), "");
  });

  it("stores a verified Stripe secret only when none is configured", async () => {
    const stored: Record<string, string> = {};
    const result = await configureStoredStripeSecret("sk_live_abcdefghijklmnopqrstuv", {
      resolve: async () => "",
      verify: async () => ({ accountId: "acct_test" }),
      store: async (key, value) => {
        stored[key] = value;
      },
    });
    assert.equal(result.configured, true);
    assert.equal(result.accountId, "acct_test");
    assert.equal(stored["stripe:secret_key"], "sk_live_abcdefghijklmnopqrstuv");

    await assert.rejects(
      () =>
        configureStoredStripeSecret("sk_live_abcdefghijklmnopqrstuv", {
          resolve: async () => "sk_live_already_set_value",
          verify: async () => ({ accountId: "acct_other" }),
          store: async () => {
            throw new Error("should not store");
          },
        }),
      (err: unknown) => err instanceof StripeRequestError && err.status === 409
    );
    await assert.rejects(
      () => configureStoredStripeSecret("not-a-key"),
      (err: unknown) => err instanceof StripeRequestError && err.status === 400
    );
  });
});

describe("landing SSR bundle", () => {
  it("does not statically import Stripe crypto or checkout from getServerAuth", () => {
    const auth = readFileSync(new URL("./auth.ts", import.meta.url), "utf8");
    assert.equal(/from ["']@\/lib\/stripeCheckout["']/.test(auth), false);
    assert.equal(/from ["']@\/lib\/stripe["']/.test(auth), false);
    assert.match(auth, /import\(["']@\/lib\/stripeCheckout["']\)/);

    const checkout = readFileSync(new URL("./stripeCheckout.ts", import.meta.url), "utf8");
    assert.equal(/from ["']@\/lib\/stripe["']/.test(checkout), false);
    assert.match(checkout, /import\(["']@\/lib\/stripe["']\)/);
  });

  it("does not statically import Clerk server auth from the dashboard page", () => {
    const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
    assert.equal(/from ["']@clerk\/nextjs\/server["']/.test(page), false);
    assert.equal(/\bauth\.protect\b/.test(page), false);
  });
});

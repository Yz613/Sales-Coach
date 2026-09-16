import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  hostedBillingRequired,
  isPaidHostedPlan,
  planFromClerkHas,
  planFromMetadata,
} from "./billingAccess";

describe("hostedBillingRequired", () => {
  it("honors BILLING_REQUIRED and otherwise follows Clerk auth", () => {
    assert.equal(hostedBillingRequired({ BILLING_REQUIRED: "false" }), false);
    assert.equal(hostedBillingRequired({ BILLING_REQUIRED: "true" }), true);
    assert.equal(hostedBillingRequired({}), false);
    assert.equal(
      hostedBillingRequired({
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test",
        CLERK_SECRET_KEY: "sk_test",
      }),
      true
    );
  });
});

describe("planFromClerkHas", () => {
  it("maps org plan slugs onto hosted plan ids", () => {
    assert.equal(planFromClerkHas((res) => "plan" in res && res.plan === "org:team"), "team");
    assert.equal(planFromClerkHas((res) => "plan" in res && res.plan === "starter"), "coach");
    assert.equal(planFromClerkHas(() => false), null);
    assert.equal(planFromClerkHas(undefined), null);
  });
});

describe("plan helpers", () => {
  it("treats only paid hosted plans as entitled", () => {
    assert.equal(isPaidHostedPlan("coach"), true);
    assert.equal(isPaidHostedPlan("oss"), false);
    assert.equal(isPaidHostedPlan(null), false);
    assert.equal(planFromMetadata({ plan: "hosted_team" }), "team");
  });
});

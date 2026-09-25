import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  hasClerkPublishableKey,
  hasClerkSecretKey,
  hasClerkServerAuth,
} from "./clerk-env";
import { authRedirectPath, publicGuestAuth, type AuthUser } from "./auth";

function guest(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    userId: null,
    role: "admin",
    isAdmin: true,
    isMember: false,
    isClerkConfigured: false,
    canViewAllCalls: true,
    tenantId: null,
    clerkPlanId: null,
    billingPaid: false,
    ...overrides,
  };
}

describe("clerk-env", () => {
  it("requires both keys before enabling clerkMiddleware/auth()", () => {
    const prevPub = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    const prevSecret = process.env.CLERK_SECRET_KEY;

    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test";
    delete process.env.CLERK_SECRET_KEY;
    assert.equal(hasClerkPublishableKey(), true);
    assert.equal(hasClerkSecretKey(), false);
    assert.equal(hasClerkServerAuth(), false);

    process.env.CLERK_SECRET_KEY = "sk_test";
    assert.equal(hasClerkServerAuth(), true);

    if (prevPub === undefined) delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = prevPub;
    if (prevSecret === undefined) delete process.env.CLERK_SECRET_KEY;
    else process.env.CLERK_SECRET_KEY = prevSecret;
  });
});

describe("hosted Clerk config", () => {
  it("does not commit the live publishable key in wrangler vars", () => {
    const wrangler = readFileSync(new URL("../../wrangler.jsonc", import.meta.url), "utf8");
    assert.doesNotMatch(wrangler, /"NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"\s*:/);
  });
});

describe("publicGuestAuth", () => {
  it("does not claim a local tenant on hosted Clerk", () => {
    const prevBilling = process.env.BILLING_REQUIRED;
    const prevPub = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    const prevSecret = process.env.CLERK_SECRET_KEY;
    process.env.BILLING_REQUIRED = "true";
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_live_test";
    process.env.CLERK_SECRET_KEY = "sk_test";

    const guest = publicGuestAuth();
    assert.equal(guest.userId, null);
    assert.equal(guest.tenantId, null);
    assert.equal(guest.billingPaid, false);
    assert.equal(guest.isClerkConfigured, true);

    if (prevBilling === undefined) delete process.env.BILLING_REQUIRED;
    else process.env.BILLING_REQUIRED = prevBilling;
    if (prevPub === undefined) delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = prevPub;
    if (prevSecret === undefined) delete process.env.CLERK_SECRET_KEY;
    else process.env.CLERK_SECRET_KEY = prevSecret;
  });
});

describe("authRedirectPath", () => {
  it("sends hosted visitors to sign-in instead of the local admin app", () => {
    const prevBilling = process.env.BILLING_REQUIRED;
    const prevPub = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    const prevSecret = process.env.CLERK_SECRET_KEY;
    process.env.BILLING_REQUIRED = "true";
    delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    delete process.env.CLERK_SECRET_KEY;

    assert.equal(authRedirectPath(guest()), "/app/sign-in");

    if (prevBilling === undefined) delete process.env.BILLING_REQUIRED;
    else process.env.BILLING_REQUIRED = prevBilling;
    if (prevPub === undefined) delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = prevPub;
    if (prevSecret === undefined) delete process.env.CLERK_SECRET_KEY;
    else process.env.CLERK_SECRET_KEY = prevSecret;
  });

  it("sends signed-out Clerk users to sign-in before team selection", () => {
    const prevBilling = process.env.BILLING_REQUIRED;
    const prevPub = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    const prevSecret = process.env.CLERK_SECRET_KEY;
    process.env.BILLING_REQUIRED = "true";
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_live_test";
    process.env.CLERK_SECRET_KEY = "sk_test";

    assert.equal(
      authRedirectPath(guest({ isClerkConfigured: true, userId: null, orgId: null })),
      "/app/sign-in"
    );
    assert.equal(
      authRedirectPath(
        guest({
          isClerkConfigured: true,
          userId: "user_1",
          orgId: null,
          billingPaid: false,
        })
      ),
      "/app/select-organization"
    );

    if (prevBilling === undefined) delete process.env.BILLING_REQUIRED;
    else process.env.BILLING_REQUIRED = prevBilling;
    if (prevPub === undefined) delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = prevPub;
    if (prevSecret === undefined) delete process.env.CLERK_SECRET_KEY;
    else process.env.CLERK_SECRET_KEY = prevSecret;
  });
});

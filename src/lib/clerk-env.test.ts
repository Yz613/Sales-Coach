import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  hasClerkPublishableKey,
  hasClerkSecretKey,
  hasClerkServerAuth,
} from "./clerk-env";

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

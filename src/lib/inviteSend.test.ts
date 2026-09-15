import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  clerkErrorMessage,
  isDuplicateInviteError,
  sendOrganizationInvites,
  type ClerkInviteApi,
  type ClerkInvitation,
} from "./inviteSend";

function invitation(overrides: Partial<ClerkInvitation> = {}): ClerkInvitation {
  return {
    id: "orginv_1",
    emailAddress: "alex@team.com",
    role: "org:member",
    url: "https://clerk.example.com/v1/tickets/accept?ticket=abc",
    createdAt: 1,
    ...overrides,
  };
}

describe("clerk invite errors", () => {
  it("prefers Clerk longMessage and detects duplicates", () => {
    const err = {
      errors: [{ code: "duplicate_record", message: "short", longMessage: "That email already has a pending invite." }],
    };
    assert.equal(clerkErrorMessage(err), "That email already has a pending invite.");
    assert.equal(isDuplicateInviteError(err), true);
    assert.equal(isDuplicateInviteError(new Error("network")), false);
  });
});

describe("sendOrganizationInvites", () => {
  it("revokes a stale pending invite, creates a new one, and emails via Resend", async () => {
    const existing = invitation({ id: "orginv_old" });
    const created = invitation({ id: "orginv_new" });
    const calls: string[] = [];
    const clerk: ClerkInviteApi = {
      async listPending() {
        return [existing];
      },
      async create(params) {
        calls.push(`create:${params.emailAddress}:notify=${params.notify}`);
        assert.equal(params.redirectUrl, "https://example.com/app/accept-invite");
        assert.equal(params.notify, false);
        return created;
      },
      async revoke(params) {
        calls.push(`revoke:${params.invitationId}`);
      },
    };

    const originalFetch = globalThis.fetch;
    const fetchCalls: string[] = [];
    globalThis.fetch = (async (_url, init) => {
      fetchCalls.push(String(init?.body || ""));
      return new Response(JSON.stringify({ id: "email_1" }), { status: 200 });
    }) as typeof fetch;

    try {
      const results = await sendOrganizationInvites({
        organizationId: "org_1",
        organizationName: "Acme",
        inviterUserId: "user_1",
        emails: ["alex@team.com"],
        role: "org:member",
        redirectUrl: "https://example.com/app/accept-invite",
        clerk,
        resendApiKey: "re_test",
      });
      assert.equal(results[0].ok, true);
      assert.equal(results[0].emailDelivery, "resend");
      assert.equal(results[0].url, created.url);
      assert.deepEqual(calls, ["revoke:orginv_old", "create:alex@team.com:notify=false"]);
      assert.equal(fetchCalls.length, 1);
      assert.match(fetchCalls[0], /alex@team.com/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("keeps Clerk email delivery when Resend is not configured", async () => {
    const clerk: ClerkInviteApi = {
      async listPending() {
        return [];
      },
      async create(params) {
        assert.equal(params.notify, true);
        return invitation();
      },
      async revoke() {
        throw new Error("should not revoke");
      },
    };
    const results = await sendOrganizationInvites({
      organizationId: "org_1",
      organizationName: "Acme",
      inviterUserId: "user_1",
      emails: ["alex@team.com"],
      role: "org:admin",
      redirectUrl: "https://example.com/app/accept-invite",
      clerk,
    });
    assert.equal(results[0].ok, true);
    assert.equal(results[0].emailDelivery, "clerk");
  });

  it("returns a copyable link when Resend fails after Clerk creates the invite", async () => {
    const clerk: ClerkInviteApi = {
      async listPending() {
        return [];
      },
      async create() {
        return invitation();
      },
      async revoke() {},
    };
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ message: "domain not verified" }), { status: 403 })) as typeof fetch;
    try {
      const results = await sendOrganizationInvites({
        organizationId: "org_1",
        organizationName: "Acme",
        inviterUserId: "user_1",
        emails: ["alex@team.com"],
        role: "org:member",
        redirectUrl: "https://example.com/app/accept-invite",
        clerk,
        resendApiKey: "re_test",
      });
      assert.equal(results[0].ok, true);
      assert.equal(results[0].emailDelivery, "link_only");
      assert.match(results[0].error || "", /domain not verified/);
      assert.ok(results[0].url);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

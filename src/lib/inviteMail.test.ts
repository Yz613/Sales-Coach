import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildInviteEmail, maskSecret, sendInviteMail } from "./inviteMail";

describe("invite email content", () => {
  it("includes the org name, role, and accept URL", () => {
    const email = buildInviteEmail({
      organizationName: "Acme <Sales>",
      acceptUrl: "https://refreshqueue.com/app/accept-invite?ticket=1",
      roleLabel: "Member",
    });
    assert.match(email.subject, /Acme/);
    assert.match(email.text, /https:\/\/refreshqueue.com\/app\/accept-invite\?ticket=1/);
    assert.match(email.html, /Join Acme &lt;Sales&gt;/);
    assert.match(email.html, /Accept invite/);
    assert.equal(email.html.includes(`<html lang="en">`), true);
  });

  it("masks stored keys", () => {
    assert.equal(maskSecret("re_1234567890abcd"), "re_123••••••••abcd");
  });
});

describe("sendInviteMail", () => {
  it("posts to Resend with an idempotency key and checks error payloads", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), init: init || {} });
      return new Response(JSON.stringify({ id: "email_123" }), { status: 200 });
    };
    const result = await sendInviteMail(
      {
        apiKey: "re_test",
        to: "alex@team.com",
        idempotencyKey: "org-invite/inv_1",
        content: buildInviteEmail({
          organizationName: "Acme",
          acceptUrl: "https://example.com/join",
          roleLabel: "Admin",
        }),
      },
      fetchImpl
    );
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.id, "email_123");
    assert.equal(calls[0].url, "https://api.resend.com/emails");
    const headers = calls[0].init.headers as Record<string, string>;
    assert.equal(headers["Idempotency-Key"], "org-invite/inv_1");
  });

  it("surfaces Resend API errors instead of throwing", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ message: "Invalid `from` field" }), { status: 403 });
    const result = await sendInviteMail(
      {
        apiKey: "re_test",
        to: "alex@team.com",
        idempotencyKey: "org-invite/inv_2",
        content: buildInviteEmail({
          organizationName: "Acme",
          acceptUrl: "https://example.com/join",
          roleLabel: "Member",
        }),
      },
      fetchImpl
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /Invalid `from` field/);
  });
});

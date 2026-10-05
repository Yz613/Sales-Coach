import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  INTEGRATION_REQUEST_TO,
  buildIntegrationRequestEmail,
  parseIntegrationRequest,
  submitIntegrationRequest,
} from "./integrationRequest";
import type { SendInviteMailInput } from "./inviteMail";
import { SecurityPolicyError } from "./security-policy";

const valid = {
  name: "Ada",
  email: "ada@example.com",
  integration: "Zoom",
  useCase: "We already record calls there and want them in coaching.",
};

const env = {
  RESEND_API_KEY: "re_test",
  RESEND_FROM_EMAIL: "Refresh Queue <invites@refreshqueue.com>",
};

describe("integration request parsing", () => {
  it("requires an email, an integration name, and a short use case", () => {
    assert.equal(parseIntegrationRequest(null).ok, false);
    assert.equal(parseIntegrationRequest({ ...valid, email: "not-an-email" }).ok, false);
    assert.equal(parseIntegrationRequest({ ...valid, integration: "A" }).ok, false);
    assert.equal(parseIntegrationRequest({ ...valid, useCase: "too short" }).ok, false);
    assert.equal(parseIntegrationRequest({ ...valid, name: "" }).ok, true);
    const parsed = parseIntegrationRequest(valid);
    assert.equal(parsed.ok, true);
    if (parsed.ok && !parsed.honeypot) assert.equal(parsed.integration, "Zoom");
  });

  it("treats a filled honeypot as a silent success later, not a validation error", () => {
    const parsed = parseIntegrationRequest({ ...valid, companyWebsite: "https://spam.example" });
    assert.deepEqual(parsed, { ok: true, honeypot: true });
  });

  it("escapes the request in the email body", () => {
    const email = buildIntegrationRequestEmail({
      name: "A & B",
      email: "ada@example.com",
      integration: "Zoom",
      useCase: "<script>alert(1)</script> is not a tool we have.",
    });
    assert.match(email.subject, /Zoom/);
    assert.match(email.text, /ada@example.com/);
    assert.match(email.html, /A &amp; B/);
    assert.match(email.html, /&lt;script&gt;/);
    assert.equal(email.html.includes("<script>"), false);
  });
});

describe("integration request delivery", () => {
  it("emails waitlist@refreshqueue.com and does not echo the mailer error", async () => {
    const sent: SendInviteMailInput[] = [];
    const limits: string[] = [];
    const result = await submitIntegrationRequest(valid, {
      ip: "203.0.113.8",
      env,
      consumeLimit: async (identity) => {
        limits.push(identity);
      },
      send: async (input) => {
        sent.push(input);
        return { ok: true, id: "email_1" };
      },
    });
    assert.deepEqual(result, { status: 200, body: { ok: true } });
    assert.equal(INTEGRATION_REQUEST_TO, "waitlist@refreshqueue.com");
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, "waitlist@refreshqueue.com");
    assert.equal(sent[0].replyTo, "ada@example.com");
    assert.equal(sent[0].from, env.RESEND_FROM_EMAIL);
    assert.match(sent[0].content.text, /We already record calls there/);
    assert.equal(limits.length, 2);
    assert.match(limits[0], /^public:integration-request:[a-f0-9]{32}$/);
    assert.equal(limits[1], "public:integration-request:global");
    assert.equal(limits[0].includes("203.0.113.8"), false);
  });

  it("drops honeypot submissions without sending", async () => {
    let sent = 0;
    const result = await submitIntegrationRequest(
      { ...valid, companyWebsite: "http://bot.example" },
      {
        ip: "203.0.113.9",
        env,
        consumeLimit: async () => {},
        send: async () => {
          sent += 1;
          return { ok: true, id: "nope" };
        },
      }
    );
    assert.deepEqual(result, { status: 200, body: { ok: true } });
    assert.equal(sent, 0);
  });

  it("returns a clear error when mail is not configured or the send fails", async () => {
    const missing = await submitIntegrationRequest(valid, {
      ip: "203.0.113.10",
      env: { RESEND_API_KEY: "", RESEND_FROM_EMAIL: "" },
      consumeLimit: async () => {},
      send: async () => ({ ok: true, id: "unused" }),
    });
    assert.equal(missing.status, 422);
    if ("error" in missing.body) {
      assert.match(missing.body.error, /waitlist@refreshqueue.com/);
      assert.doesNotMatch(missing.body.error, /Resend|Clerk|Stripe|Cloudflare/);
    }

    const failed = await submitIntegrationRequest(valid, {
      ip: "203.0.113.11",
      env,
      consumeLimit: async () => {},
      send: async () => ({ ok: false, error: "Resend rejected the invite email (403)" }),
    });
    assert.equal(failed.status, 422);
    if ("error" in failed.body) assert.doesNotMatch(failed.body.error, /Resend/);
  });

  it("returns a clear error when rate-limit storage fails", async () => {
    let sent = 0;
    const result = await submitIntegrationRequest(valid, {
      ip: "203.0.113.13",
      env,
      consumeLimit: async () => {
        throw new Error("D1_ERROR: no such table: main.calls");
      },
      send: async () => {
        sent += 1;
        return { ok: true, id: "email_3" };
      },
    });
    assert.equal(result.status, 422);
    if ("error" in result.body) {
      assert.match(result.body.error, /waitlist@refreshqueue.com/);
      assert.doesNotMatch(result.body.error, /D1_ERROR|calls/);
    }
    assert.equal(sent, 0);
  });

  it("rate limits before sending", async () => {
    let sent = 0;
    const result = await submitIntegrationRequest(valid, {
      ip: "203.0.113.12",
      env,
      consumeLimit: async () => {
        throw new SecurityPolicyError("Too many requests. Try again shortly.", 429, "RATE_LIMITED");
      },
      send: async () => {
        sent += 1;
        return { ok: true, id: "email_2" };
      },
    });
    assert.equal(result.status, 429);
    if ("error" in result.body) assert.match(result.body.error, /Too many requests/);
    assert.equal(sent, 0);
  });
});

describe("integration request route", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "integration-request-"));
  const previous = {
    db: process.env.SALES_COACH_DB_PATH,
    key: process.env.RESEND_API_KEY,
    from: process.env.RESEND_FROM_EMAIL,
    fetch: global.fetch,
  };
  after(() => {
    process.env.SALES_COACH_DB_PATH = previous.db;
    process.env.RESEND_API_KEY = previous.key;
    process.env.RESEND_FROM_EMAIL = previous.from;
    global.fetch = previous.fetch;
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it("posts the request to the mail API from the public route", async () => {
    process.env.SALES_COACH_DB_PATH = path.join(directory, "test.db");
    process.env.RESEND_API_KEY = "re_route_test";
    process.env.RESEND_FROM_EMAIL = "Refresh Queue <invites@refreshqueue.com>";
    const calls: { url: string; body: string }[] = [];
    global.fetch = async (url, init) => {
      calls.push({ url: String(url), body: String(init?.body || "") });
      return new Response(JSON.stringify({ id: "email_route" }), { status: 200 });
    };
    const { POST } = await import("../app/api/marketing/integration-request/route");
    const response = await POST(new Request("http://127.0.0.1:3000/app/api/marketing/integration-request", {
      method: "POST",
      headers: { origin: "http://127.0.0.1:3000", "content-type": "application/json" },
      body: JSON.stringify(valid),
    }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://api.resend.com/emails");
    const payload = JSON.parse(calls[0].body) as { to: string[]; reply_to: string[]; subject: string; text: string };
    assert.deepEqual(payload.to, ["waitlist@refreshqueue.com"]);
    assert.deepEqual(payload.reply_to, ["ada@example.com"]);
    assert.match(payload.subject, /Zoom/);
    assert.match(payload.text, /We already record calls there/);

    const rejected = await POST(new Request("http://127.0.0.1:3000/app/api/marketing/integration-request", {
      method: "POST",
      headers: { origin: "http://127.0.0.1:3000", "content-type": "application/json" },
      body: JSON.stringify({ email: "ada@example.com" }),
    }));
    assert.equal(rejected.status, 400);
    const error = await rejected.json() as { error: string };
    assert.match(error.error, /integration/i);
    assert.equal(calls.length, 1);
  });
});

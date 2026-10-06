import { readFileSync } from "node:fs";
import { after, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { reportPaidCheckoutTransition } from "./stripeCheckout";
import {
  VISITOR_FOLLOW_UP_TIMEOUT_MS,
  identifySignupVisitor,
  integrationRequestIdentifyBody,
  notifyIntegrationRequest,
  notifyPaidSubscription,
  notifyWorkspaceCreated,
  paidSubscriptionConversionBody,
  postVisitorFollowUp,
  resetVisitorFollowUpForTests,
  scheduleVisitorFollowUp,
  visitorFollowUpServerConfig,
  workspaceCreatedConversionBody,
} from "./visitorFollowUp";

const env = {
  VISITOR_FOLLOW_UP_ENDPOINT: "https://followup.refreshqueue.com",
  VISITOR_FOLLOW_UP_API_KEY: "vfu_live_test",
};

type Captured = { url: string; init?: RequestInit };

function jsonBody(init?: RequestInit): Record<string, unknown> {
  return JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
}

describe("visitor follow-up client", () => {
  const originalFetch = globalThis.fetch;
  let calls: Captured[];

  after(() => {
    globalThis.fetch = originalFetch;
  });

  beforeEach(() => {
    resetVisitorFollowUpForTests();
    calls = [];
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response("{}", { status: 200 });
    };
  });

  it("no-ops when the endpoint or key is unset and never throws", async () => {
    assert.equal(visitorFollowUpServerConfig({}), null);
    assert.equal(visitorFollowUpServerConfig({ VISITOR_FOLLOW_UP_ENDPOINT: "https://followup.refreshqueue.com" }), null);
    assert.equal(visitorFollowUpServerConfig({ VISITOR_FOLLOW_UP_API_KEY: "vfu_live_test" }), null);
    assert.equal(VISITOR_FOLLOW_UP_TIMEOUT_MS > 0 && VISITOR_FOLLOW_UP_TIMEOUT_MS <= 2000, true);

    const input = {
      name: "Ada",
      email: "ada@example.com",
      integration: "Zoom",
      useCase: "We need call import.",
    };
    const lead = integrationRequestIdentifyBody(input);
    assert.equal(await postVisitorFollowUp("/v1/identify", lead, {}), "skipped");
    assert.equal(await postVisitorFollowUp("/v1/identify", { ...lead, email: "not-an-email" }, env), "skipped");
    notifyIntegrationRequest(input, {});
    notifyPaidSubscription("ada@example.com", {});
    notifyWorkspaceCreated("ada@example.com", {});
    identifySignupVisitor({ email: "ada@example.com", name: "Ada" }, {});
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(calls.length, 0);

    const failed = await postVisitorFollowUp("/v1/identify", lead, env, async () => {
      throw new Error("network down");
    });
    assert.equal(failed, "failed");
    const rejected = await postVisitorFollowUp("/v1/conversions", paidSubscriptionConversionBody("ada@example.com"), env, async () => {
      return new Response("no", { status: 503 });
    });
    assert.equal(rejected, "failed");
  });

  it("posts identify with the bearer key and a short timeout", async () => {
    let signal: AbortSignal | undefined;
    const result = await postVisitorFollowUp(
      "/v1/identify",
      integrationRequestIdentifyBody({
        name: "Ada",
        email: "Ada@Example.com",
        integration: "Zoom",
        useCase: "Import recorded calls.",
      }),
      env,
      async (url, init) => {
        signal = init?.signal || undefined;
        calls.push({ url, init });
        return new Response("{}", { status: 200 });
      },
      25
    );
    assert.equal(result, "sent");
    assert.equal(calls[0]?.url, "https://followup.refreshqueue.com/v1/identify");
    const headers = new Headers(calls[0]?.init?.headers);
    assert.equal(headers.get("authorization"), "Bearer vfu_live_test");
    assert.equal(headers.get("content-type"), "application/json");
    assert.equal(calls[0]?.init?.redirect, "manual");
    assert.equal(signal?.aborted, false);
    assert.deepEqual(jsonBody(calls[0]?.init), {
      site_id: "sales-coach",
      email: "ada@example.com",
      traits: { name: "Ada", integration: "Zoom", useCase: "Import recorded calls." },
      email_source: "form:integration-request",
    });

    const started = Date.now();
    const timedOut = await Promise.race([
      postVisitorFollowUp("/v1/identify", integrationRequestIdentifyBody({
        name: "Ada",
        email: "ada@example.com",
        integration: "Zoom",
        useCase: "Import recorded calls.",
      }), env, (_url, init) => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason ?? new Error("aborted")));
      }), 40),
      new Promise<string>((resolve) => setTimeout(() => resolve("still-pending"), 500)),
    ]);
    assert.equal(timedOut, "failed");
    assert.ok(Date.now() - started < 1000);
  });

  it("posts a paying-customer conversion when checkout becomes paid", async () => {
    const previousEndpoint = process.env.VISITOR_FOLLOW_UP_ENDPOINT;
    const previousKey = process.env.VISITOR_FOLLOW_UP_API_KEY;
    process.env.VISITOR_FOLLOW_UP_ENDPOINT = env.VISITOR_FOLLOW_UP_ENDPOINT;
    process.env.VISITOR_FOLLOW_UP_API_KEY = env.VISITOR_FOLLOW_UP_API_KEY;
    try {
    reportPaidCheckoutTransition(null, { status: "unpaid", email: "buyer@example.com" });
    reportPaidCheckoutTransition({ status: "paid", email: "buyer@example.com" }, { status: "paid", email: "buyer@example.com" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(calls.length, 0);

    reportPaidCheckoutTransition(null, { status: "paid", email: "Buyer@Example.com" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.url, "https://followup.refreshqueue.com/v1/conversions");
    const headers = new Headers(calls[0]?.init?.headers);
    assert.equal(headers.get("authorization"), "Bearer vfu_live_test");
    assert.deepEqual(jsonBody(calls[0]?.init), {
      site_id: "sales-coach",
      email: "buyer@example.com",
      conversion_type: "stripe_subscription_paid",
      is_customer: true,
    });

    calls.length = 0;
    notifyPaidSubscription("buyer@example.com", env);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(calls.length, 0);

    const checkout = readFileSync(new URL("./stripeCheckout.ts", import.meta.url), "utf8");
    assert.match(checkout, /reportPaidCheckoutTransition\(existing, record\)/);
    assert.match(checkout, /notifyPaidSubscription\(record\.email \|\| input\.email\)/);
    } finally {
      if (previousEndpoint === undefined) delete process.env.VISITOR_FOLLOW_UP_ENDPOINT;
      else process.env.VISITOR_FOLLOW_UP_ENDPOINT = previousEndpoint;
      if (previousKey === undefined) delete process.env.VISITOR_FOLLOW_UP_API_KEY;
      else process.env.VISITOR_FOLLOW_UP_API_KEY = previousKey;
    }
  });

  it("reports a new workspace without marking the creator as a paying customer", async () => {
    notifyWorkspaceCreated("Founder@Example.com", env);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.deepEqual(jsonBody(calls[0]?.init), workspaceCreatedConversionBody("founder@example.com"));
    assert.equal(jsonBody(calls[0]?.init).is_customer, false);
    assert.equal(jsonBody(calls[0]?.init).conversion_type, "workspace_created");
    const team = readFileSync(new URL("./team.ts", import.meta.url), "utf8");
    assert.match(team, /notifyWorkspaceCreated\(clerkUserEmail\(user\)\)/);
    assert.doesNotMatch(team.slice(team.indexOf("export async function sendTeamInvites")), /notifyWorkspaceCreated|notifyIntegrationRequest|\/v1\/identify/);
  });

  it("identifies a verified sign-up once", async () => {
    identifySignupVisitor({ email: "Ada@Example.com", name: "Ada Lovelace" }, env);
    identifySignupVisitor({ email: "ada@example.com", name: "Ada Lovelace" }, env);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.url, "https://followup.refreshqueue.com/v1/identify");
    assert.deepEqual(jsonBody(calls[0]?.init), {
      site_id: "sales-coach",
      email: "ada@example.com",
      email_source: "signup",
      traits: { name: "Ada Lovelace" },
    });
    const auth = readFileSync(new URL("./auth.ts", import.meta.url), "utf8");
    assert.match(auth, /identifySignupVisitor\(\{ email, name: name \|\| null \}\)/);
  });

  it("hands the request to waitUntil when the worker context has it", async () => {
    const waited: Promise<unknown>[] = [];
    let finished = false;
    scheduleVisitorFollowUp(Promise.resolve().then(() => {
      finished = true;
    }), () => (promise) => {
      waited.push(promise);
    });
    assert.equal(waited.length, 1);
    await waited[0];
    assert.equal(finished, true);
  });

  it("never reports teammate invites or the footer mailto as leads", () => {
    const inviteForm = readFileSync(new URL("../components/InviteTeammatesForm.tsx", import.meta.url), "utf8");
    const inviteMail = readFileSync(new URL("./inviteMail.ts", import.meta.url), "utf8");
    const inviteSend = readFileSync(new URL("./inviteSend.ts", import.meta.url), "utf8");
    const shell = readFileSync(new URL("../components/MarketingShell.tsx", import.meta.url), "utf8");
    const form = readFileSync(new URL("../components/IntegrationRequestForm.tsx", import.meta.url), "utf8");
    for (const source of [inviteForm, inviteMail, inviteSend, shell]) {
      assert.equal(source.includes("data-vf-"), false);
      assert.equal(source.includes("visitorFollowUp"), false);
      assert.equal(source.includes("/v1/identify"), false);
      assert.equal(source.includes("/v1/conversions"), false);
    }
    assert.match(shell, /mailto:\$\{CONTACT_EMAIL\}/);
    assert.match(form, /data-vf-auto-hook=/);
    assert.match(form, /data-vf-source="integration-request"/);
    assert.doesNotMatch(inviteMail, /notifyIntegrationRequest|notifyPaidSubscription|notifyWorkspaceCreated|identifySignupVisitor/);
  });
});

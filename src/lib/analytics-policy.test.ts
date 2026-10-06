import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ANALYTICS_INGEST_HOST,
  CONSENT_NOT_COLLECTED,
  contactIdForActivity,
  identityPlan,
  isSameOriginMutation,
  pagePathname,
  personFields,
  planFormSuccess,
  redactAnalyticsEvent,
  stableAccountId,
  stableContactIdFromEmail,
  submissionSucceeded,
} from "./analytics-policy";
import { POSTHOG_API_HOST, POSTHOG_PROJECT_ID, POSTHOG_PROJECT_TOKEN, productAnalyticsInitOptions } from "./analytics-public";
import {
  VISITOR_FOLLOW_UP_SITE_ID,
  visitorFollowUpBrowserScriptSrc,
  visitorFollowUpConnectHosts,
  visitorFollowUpScriptHosts,
} from "./visitorFollowUpPublic";

describe("product analytics policy", () => {
  it("uses the public US project token and ingest host", () => {
    assert.equal(POSTHOG_PROJECT_ID, "645997");
    assert.equal(POSTHOG_PROJECT_TOKEN, "phc_mVffCXjymuk8ir9UF2n92VABboozTTEpfKWqvKkcGZGL");
    assert.equal(POSTHOG_API_HOST, "https://us.i.posthog.com");
    assert.equal(ANALYTICS_INGEST_HOST, "https://us.i.posthog.com");
    assert.equal(POSTHOG_PROJECT_TOKEN.startsWith("phx_"), false);
    const options = productAnalyticsInitOptions();
    assert.equal(options.api_host, "https://us.i.posthog.com");
    assert.equal(options.ui_host, "https://us.posthog.com");
    assert.equal(options.defaults, "2026-05-30");
    assert.deepEqual(options.capture_pageview, { path: true, search: true, hash: true });
    assert.equal(options.disable_capture_url_hashes, false);
    assert.equal(options.person_profiles, "identified_only");
    assert.equal(options.disable_session_recording, true);
    assert.equal(options.reuseAnonymousId, undefined);
    assert.equal(options.opt_out_capturing_by_default, undefined);
    assert.equal(JSON.stringify(options).includes("eu.i.posthog.com"), false);
    assert.equal(JSON.stringify(options).includes("phx_"), false);
  });

  it("keeps anonymous activity until an account or submitted contact exists", () => {
    assert.equal(stableAccountId("user_2NNEqL2nrIRdJ194"), "user_2NNEqL2nrIRdJ194");
    assert.equal(stableAccountId("anonymous"), null);
    assert.equal(stableAccountId("user"), null);
    assert.equal(stableAccountId("local"), null);
    assert.equal(stableAccountId("11111111-1111-1111-1111-111111111111"), null);
    assert.equal(stableAccountId("contact_" + "a".repeat(32)), null);

    assert.deepEqual(
      identityPlan({
        accountId: null,
        distinctId: "11111111-1111-1111-1111-111111111111",
        isIdentified: false,
        storedAccountId: null,
      }),
      { action: "none", captureSignedIn: false, storedAccountId: null }
    );
    assert.deepEqual(
      identityPlan({
        accountId: "user_2NNEqL2nrIRdJ194",
        distinctId: "11111111-1111-1111-1111-111111111111",
        isIdentified: false,
        storedAccountId: null,
      }).action,
      "identify"
    );
    assert.equal(
      identityPlan({
        accountId: "user_2NNEqL2nrIRdJ194",
        distinctId: "user_2NNEqL2nrIRdJ194",
        isIdentified: true,
        storedAccountId: "user_2NNEqL2nrIRdJ194",
      }).captureSignedIn,
      false
    );
    assert.equal(
      identityPlan({
        accountId: null,
        distinctId: "user_2NNEqL2nrIRdJ194",
        isIdentified: true,
        storedAccountId: "user_2NNEqL2nrIRdJ194",
      }).action,
      "reset"
    );
    assert.equal(
      identityPlan({
        accountId: null,
        distinctId: "contact_" + "ab".repeat(16),
        isIdentified: true,
        storedAccountId: null,
      }).action,
      "none"
    );
  });

  it("identifies a successful submit without copying the email or inventing consent", async () => {
    const fields = personFields("integration_request");
    assert.deepEqual(fields, {
      email_source: "integration_request",
      consent_status: CONSENT_NOT_COLLECTED,
      consent_time: null,
    });
    assert.equal("email" in fields, false);

    const first = await stableContactIdFromEmail("Ada@Example.com");
    const second = await stableContactIdFromEmail("ada@example.com");
    assert.equal(first, second);
    assert.match(first || "", /^contact_[a-f0-9]{32}$/);
    assert.equal((first || "").includes("ada"), false);
    assert.equal(await stableContactIdFromEmail("not-an-email"), null);

    const account = "user_2NNEqL2nrIRdJ194";
    assert.equal(contactIdForActivity({ accountId: account, emailContactId: first }), account);

    const planned = await planFormSuccess({
      formId: "integration_request",
      pagePath: "/app/integrations?email=ada@example.com",
      emailSource: "integration_request",
      email: "ada@example.com",
      accountId: null,
    });
    assert.equal(planned.contactId, first);
    assert.equal(planned.properties.page_path, "/app/integrations");
    assert.equal(planned.properties.email_source, "integration_request");
    assert.equal(planned.properties.consent_status, "not_collected");
    assert.equal(planned.properties.consent_time, null);
    assert.equal(JSON.stringify(planned).includes("ada@example.com"), false);
    assert.equal(pagePathname("/app/integrations"), "/app/integrations");
    assert.equal(pagePathname("https://evil.example"), "/");

    const anonymous = await planFormSuccess({
      formId: "upload",
      pagePath: "/app/calls",
      emailSource: null,
      email: "ada@example.com",
      accountId: account,
    });
    assert.equal(anonymous.contactId, null);
    assert.equal(anonymous.person, null);
    assert.equal("email_source" in anonymous.properties, false);
  });

  it("counts same-origin form requests only when they succeed", () => {
    const origin = "https://refreshqueue.com";
    assert.equal(isSameOriginMutation("https://refreshqueue.com/app/api/integrations/request", "POST", origin), true);
    assert.equal(isSameOriginMutation("https://refreshqueue.com/app/__auth/v1/client", "POST", origin), false);
    assert.equal(isSameOriginMutation("https://us.i.posthog.com/i/v0/e/", "POST", origin), false);
    assert.equal(isSameOriginMutation("https://refreshqueue.com/app/calls", "GET", origin), false);
    assert.equal(submissionSucceeded(200, { ok: true }), true);
    assert.equal(submissionSucceeded(200, { id: "call_1" }), true);
    assert.equal(submissionSucceeded(200, { ok: false }), false);
    assert.equal(submissionSucceeded(422, { error: "no" }), false);
  });

  it("strips input values and leaves the separate contact fields", () => {
    const event = redactAnalyticsEvent({
      event: "form_submitted",
      properties: {
        email: "ada@example.com",
        password: "secret",
        token: "phc_public",
        access_token: "secret-access",
        email_source: "integration_request",
        consent_status: "not_collected",
        consent_time: null,
        $elements: [{ tag_name: "input", attr__value: "ada@example.com", attr__type: "email" }],
      },
      $set: { email: "ada@example.com", email_source: "sign_in" },
    });
    assert.equal(event?.properties?.email, undefined);
    assert.equal(event?.properties?.password, undefined);
    assert.equal(event?.properties?.access_token, undefined);
    assert.equal(event?.properties?.token, "phc_public");
    assert.equal(event?.properties?.email_source, "integration_request");
    assert.equal(event?.properties?.consent_status, "not_collected");
    assert.equal(event?.$set?.email, undefined);
    assert.equal(event?.$set?.email_source, "sign_in");
    const elements = event?.properties?.$elements as Array<Record<string, unknown>>;
    assert.equal(elements[0]?.attr__value, undefined);
    assert.equal(elements[0]?.attr__type, "email");
    assert.equal(redactAnalyticsEvent(null), null);
  });

  it("ships one browser SDK and leaves the existing page-view tag in place", () => {
    const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
    const middleware = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");
    const client = readFileSync(new URL("./analytics-browser.ts", import.meta.url), "utf8");
    const bootstrap = readFileSync(new URL("../instrumentation-client.ts", import.meta.url), "utf8");
    const contract = readFileSync(new URL("../../workflow-contract.md", import.meta.url), "utf8");
    const pkg = readFileSync(new URL("../../package.json", import.meta.url), "utf8");
    assert.match(layout, /<PageViewTracker \/>/);
    assert.match(layout, /<ProductAnalytics \/>/);
    assert.match(layout, /TAG_SCRIPT_SRC/);
    assert.match(middleware, /analyticsScriptHosts/);
    assert.match(middleware, /analyticsConnectHosts/);
    assert.match(bootstrap, /startProductAnalytics/);
    assert.match(client, /posthog\.init\(POSTHOG_PROJECT_TOKEN/);
    assert.equal(client.match(/posthog\.init\(/g)?.length, 1);
    assert.match(client, /rememberVisitorCompany\(\{/);
    assert.match(client, /groupAnalytics:\s*false/);
    assert.match(client, /apiPath\(VISITOR_COMPANY_API_PATH\)/);
    assert.doesNotMatch(client, /groupAnalytics:\s*true/);
    assert.match(client, /posthog\.identify\(/);
    assert.doesNotMatch(client, /eu\.i\.posthog\.com/);
    assert.doesNotMatch(client, /phx_/);
    assert.match(pkg, /"posthog-js"/);
    assert.doesNotMatch(pkg, /posthog-node/);
    assert.match(contract, /645997/);
    assert.match(contract, /https:\/\/us\.i\.posthog\.com/);
    assert.match(contract, /America\/New_York/);
    assert.match(contract, /sales-coach/);
    assert.match(contract, /@cf\/cloudflare\/clef/);
    assert.match(contract, /personas\.json/);
    assert.match(contract, /visitor_followup_tracker/);
    assert.doesNotMatch(contract, /phc_/);
    assert.doesNotMatch(contract, /phx_/);
  });

  it("keeps the follow-up snippet off until its public endpoint is configured", () => {
    const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
    const middleware = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");
    assert.equal(VISITOR_FOLLOW_UP_SITE_ID, "sales-coach");
    assert.match(layout, /visitorFollowUpBrowserScriptSrc\(\)/);
    assert.match(layout, /followUpScriptSrc \?/);
    assert.match(layout, /data-site=\{VISITOR_FOLLOW_UP_SITE_ID\}/);
    assert.match(layout, /nonce=\{nonce\}/);
    assert.match(middleware, /visitorFollowUpScriptHosts\(\)/);
    assert.match(middleware, /visitorFollowUpConnectHosts\(\)/);
    const previous = process.env.NEXT_PUBLIC_VISITOR_FOLLOW_UP_ENDPOINT;
    delete process.env.NEXT_PUBLIC_VISITOR_FOLLOW_UP_ENDPOINT;
    try {
      assert.equal(visitorFollowUpBrowserScriptSrc(), null);
      assert.deepEqual(visitorFollowUpScriptHosts(), []);
      assert.deepEqual(visitorFollowUpConnectHosts(), []);
    } finally {
      if (previous === undefined) delete process.env.NEXT_PUBLIC_VISITOR_FOLLOW_UP_ENDPOINT;
      else process.env.NEXT_PUBLIC_VISITOR_FOLLOW_UP_ENDPOINT = previous;
    }
    assert.equal(
      visitorFollowUpBrowserScriptSrc({ NEXT_PUBLIC_VISITOR_FOLLOW_UP_ENDPOINT: "https://followup.refreshqueue.com" }),
      "https://followup.refreshqueue.com/vf.js"
    );
    assert.deepEqual(visitorFollowUpScriptHosts({ NEXT_PUBLIC_VISITOR_FOLLOW_UP_ENDPOINT: "https://followup.refreshqueue.com" }), [
      "https://followup.refreshqueue.com",
    ]);
  });
});

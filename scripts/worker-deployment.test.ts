import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import vm from "node:vm";

const { main: verify } = require("./verify-worker.cjs");
const env = { PUBLIC_APP_URL: "https://example.com", INTEGRATION_CRON_SECRET: "x".repeat(32) };

function deploymentFetch(failure?: "auth" | "configuration" | "checkout") {
  return async (input: string) => {
    const url = new URL(input);
    if (url.pathname.endsWith("/jobs/run")) return Response.json({ jobs: [] });
    if (url.pathname.endsWith("/auth/role")) return Response.json({ userId: null, isClerkConfigured: true, ...(failure === "auth" ? { authenticationIssue: "unavailable" } : {}) });
    if (url.pathname.endsWith("/billing/checkout")) {
      if (failure === "configuration") return Response.json({ code: "SECURITY_CONFIGURATION" }, { status: 503 });
      const validPlan = ["coach", "team"].includes(url.searchParams.get("plan") || "");
      return new Response(null, { status: 303, headers: { location: validPlan && failure !== "checkout"
        ? "https://checkout.stripe.com/c/pay/cs_fixture" : "https://example.com/?checkout_error=configuration#pricing" } });
    }
    if (url.pathname.includes("/app/app/")) return new Response(null, { status: 307, headers: { location: `/app/sign-in${url.search}` } });
    if (url.pathname.endsWith("/session-recovery")) return new Response("Reconnect your session");
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: { "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
  };
}

test("deployment verification rejects failed server authentication even when middleware rejects anonymous APIs correctly", async () => {
  await assert.rejects(verify({ env, fetch: deploymentFetch("auth"), delay: async () => {} }), /server authentication/);
});

test("deployment verification rejects missing runtime security configuration", async () => {
  await assert.rejects(verify({ env, fetch: deploymentFetch("configuration"), delay: async () => {} }), /runtime configuration/);
  await verify({ env, fetch: deploymentFetch(), delay: async () => {} });
});

test("deployment verification rejects broken payment links even when an invalid plan redirects correctly", async () => {
  await assert.rejects(verify({ env, fetch: deploymentFetch("checkout"), delay: async () => {} }), /Hosted coach checkout failed/);
  const checkoutPlans: string[] = [];
  const fixture = deploymentFetch();
  await verify({ env, fetch: async (input: string, options: RequestInit) => {
    const plan = new URL(input).searchParams.get("plan");
    if (plan === "coach" || plan === "team") {
      checkoutPlans.push(plan);
      assert.equal(options.redirect, "manual", "verification must not proceed to payment");
    }
    return fixture(input);
  }, delay: async () => {} });
  assert.deepEqual(checkoutPlans, ["coach", "team"]);
});

function syncFixture(publicKey?: string, optionalSecrets: Record<string, string> = {}) {
  const uploaded: string[] = [];
  const processFixture = { cwd: () => "/fixture", env: { ...optionalSecrets, ...(publicKey ? { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: publicKey } : {}) }, exitCode: 0, exit: () => { throw new Error("Unexpected process exit"); } };
  vm.runInNewContext(fs.readFileSync(require.resolve("./sync-worker-secrets.cjs"), "utf8"), {
    process: processFixture,
    console: { log() {}, warn() {}, error() {} },
    require: () => ({ execFileSync: (_command: string, args: string[]) => {
      if (args[2] === "list") return JSON.stringify(["CLERK_SECRET_KEY", "INTEGRATION_ENCRYPTION_KEY", "INTEGRATION_CRON_SECRET", "PUBLIC_APP_URL"].map(name => ({ name })));
      uploaded.push(args[3]);
      return "";
    } }),
  });
  return { uploaded, exitCode: processFixture.exitCode };
}

test("deployment requires the public key without uploading a conflicting secret", () => {
  assert.equal(syncFixture("pk_live_fixture").uploaded.includes("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"), false);
  assert.equal(syncFixture("pk_live_fixture").exitCode, 0);
  assert.equal(syncFixture().exitCode, 1);
});

test("deployment forwards configured calendar credentials and keeps unused calendars optional", () => {
  const credentials = Object.fromEntries(["GOOGLE_CALENDAR", "MICROSOFT_CALENDAR", "CALENDLY"].flatMap(prefix =>
    ["CLIENT_ID", "CLIENT_SECRET"].map(suffix => [`${prefix}_${suffix}`, "fixture-value"])));
  const result = syncFixture("pk_live_fixture", credentials);
  assert.equal(result.exitCode, 0);
  assert.deepEqual(result.uploaded.sort(), Object.keys(credentials).sort());
  assert.equal(syncFixture("pk_live_fixture").exitCode, 0);
  const workflow = fs.readFileSync(require.resolve("../.github/workflows/deploy.yml"), "utf8");
  for (const name of Object.keys(credentials)) assert.ok(workflow.includes(name + ": ${{ secrets." + name + " }}"));
});

function configurationFixture(initial: string) {
  let source = initial;
  vm.runInNewContext(fs.readFileSync(require.resolve("./configure-worker-security.cjs"), "utf8"), {
    __dirname: "/fixture/scripts",
    process: { env: { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_fixture", REQUIRE_MFA: "false" }, exit: () => { throw new Error("Unexpected process exit"); } },
    console: { log() {}, error() {} },
    require: (name: string) => name === "node:fs"
      ? { readFileSync: () => source, writeFileSync: (_file: string, contents: string) => { source = contents; } }
      : { resolve: () => "/fixture/wrangler.jsonc" },
  });
  return JSON.parse(source);
}

test("deployment supplies Clerk at runtime and updates an existing public variable without duplicates", () => {
  for (const vars of [{ REQUIRE_MFA: "true", BILLING_REQUIRED: "true" }, { REQUIRE_MFA: "true", BILLING_REQUIRED: "true", NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_previous" }]) {
    const configuration = configurationFixture(JSON.stringify({ vars }));
    assert.equal(configuration.vars.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, "pk_live_fixture");
    assert.equal(configuration.vars.REQUIRE_MFA, "false");
    assert.equal(configuration.vars.BILLING_REQUIRED, "true");
  }
  const workflow = fs.readFileSync(require.resolve("../.github/workflows/deploy.yml"), "utf8");
  assert.match(workflow, /name: Configure authentication policy\s+env:\s+REQUIRE_MFA:[^\n]+\s+NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:/);
});

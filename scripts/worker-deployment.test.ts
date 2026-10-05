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
    require: (name: string) => name.endsWith("oauth-providers.json") ? require("../src/lib/integrations/oauth-providers.json") : ({ execFileSync: (_command: string, args: string[]) => {
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

test("deployment forwards configured OAuth credentials and keeps unused providers optional", () => {
  const credentials = Object.fromEntries(Object.values(require("../src/lib/integrations/oauth-providers.json")).flatMap((app: any) =>
    ["CLIENT_ID", "CLIENT_SECRET"].map(suffix => [`${app.prefix}_${suffix}`, "fixture-value"])));
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

const { DEFAULT_ID, injectVisitorCompanyKv, namespaceId } = require("./inject-visitor-company-kv.cjs");

function stripJsonc(source: string) {
  return source.split("\n").map((line) => {
    let inString = false;
    let out = "";
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"' && line[i - 1] !== "\\") inString = !inString;
      if (!inString && ch === "/" && line[i + 1] === "/") break;
      out += ch;
    }
    return out;
  }).join("\n");
}

function applySecurityPolicy(initial: string) {
  let source = initial;
  vm.runInNewContext(fs.readFileSync(require.resolve("./configure-worker-security.cjs"), "utf8"), {
    __dirname: "/fixture/scripts",
    process: { env: { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_fixture", REQUIRE_MFA: "false" }, exit: () => { throw new Error("Unexpected process exit"); } },
    console: { log() {}, error() {} },
    require: (name: string) => name === "node:fs"
      ? { readFileSync: () => source, writeFileSync: (_file: string, contents: string) => { source = contents; } }
      : { resolve: () => "/fixture/wrangler.jsonc" },
  });
  return source;
}

test("CI injects the visitor company KV binding without dropping production settings", () => {
  const wrangler = fs.readFileSync(require.resolve("../wrangler.jsonc"), "utf8");
  const workflow = fs.readFileSync(require.resolve("../.github/workflows/deploy.yml"), "utf8");
  assert.equal(namespaceId({}), DEFAULT_ID);
  assert.equal(namespaceId({ VISITOR_COMPANY_KV_ID: "  " }), DEFAULT_ID);
  assert.equal(namespaceId({ VISITOR_COMPANY_KV_ID: "a".repeat(32) }), "a".repeat(32));
  assert.equal(wrangler.includes(DEFAULT_ID), false, "the hosted namespace id stays out of the committed config");
  assert.equal(stripJsonc(wrangler).includes('"kv_namespaces"'), false);

  const injected = injectVisitorCompanyKv(wrangler, DEFAULT_ID);
  assert.equal(injectVisitorCompanyKv(injected, DEFAULT_ID), injected);
  const custom = "a".repeat(32);
  const replaced = injectVisitorCompanyKv(injected, custom);
  assert.equal(replaced.includes(DEFAULT_ID), false);
  assert.match(replaced, new RegExp(`"kv_namespaces": \\[\\{ "binding": "VISITOR_COMPANY_KV", "id": "${custom}" \\}\\]`));
  assert.throws(() => injectVisitorCompanyKv(wrangler, "not-a-namespace"), /32-character/);

  const withOther = wrangler.replace(
    '"d1_databases"',
    '"kv_namespaces": [{ "binding": "OTHER_KV", "id": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }],\n\t"d1_databases"',
  );
  const merged = injectVisitorCompanyKv(withOther, DEFAULT_ID);
  assert.match(merged, /"binding": "OTHER_KV"/);
  assert.match(merged, new RegExp(`"binding": "VISITOR_COMPANY_KV", "id": "${DEFAULT_ID}"`));

  const secured = applySecurityPolicy(injected);
  const configuration = JSON.parse(stripJsonc(secured));
  assert.equal(configuration.routes[0].pattern, "refreshqueue.com/*");
  assert.equal(configuration.ai.binding, "AI");
  assert.equal(configuration.vars.REQUIRE_MFA, "false");
  assert.deepEqual(configuration.kv_namespaces, [{ binding: "VISITOR_COMPANY_KV", id: DEFAULT_ID }]);
  assert.equal(configuration.name, "sales-coach");
  assert.equal(configuration.d1_databases[0].binding, "DB");
  assert.match(secured, /Self-hosters can omit it/);
  assert.match(workflow, /VISITOR_COMPANY_KV_ID: \$\{\{ vars\.VISITOR_COMPANY_KV_ID \}\}/);
  assert.match(workflow, /REQUIRE_MFA: \$\{\{ vars\.REQUIRE_MFA \}\}/);
  assert.match(workflow, new RegExp(DEFAULT_ID));
  const markers = ["resolve-d1-id.cjs", "inject-visitor-company-kv.cjs", "configure-worker-security.cjs", "npm run deploy"];
  let at = -1;
  for (const marker of markers) {
    const next = workflow.indexOf(marker);
    assert.ok(next > at, marker);
    at = next;
  }
});

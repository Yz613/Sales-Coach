import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import vm from "node:vm";

const { main: verify } = require("./verify-worker.cjs");
const env = { PUBLIC_APP_URL: "https://example.com", INTEGRATION_CRON_SECRET: "x".repeat(32) };

function deploymentFetch(failure?: "auth" | "configuration") {
  return async (input: string) => {
    const url = new URL(input);
    if (url.pathname.endsWith("/jobs/run")) return Response.json({ jobs: [] });
    if (url.pathname.endsWith("/auth/role")) return Response.json({ userId: null, isClerkConfigured: true, ...(failure === "auth" ? { authenticationIssue: "unavailable" } : {}) });
    if (url.pathname.endsWith("/billing/checkout")) return failure === "configuration"
      ? Response.json({ code: "SECURITY_CONFIGURATION" }, { status: 503 })
      : new Response(null, { status: 303, headers: { location: "https://example.com/#pricing" } });
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

function syncFixture(publicKey?: string) {
  const uploaded: string[] = [];
  const processFixture = { cwd: () => "/fixture", env: publicKey ? { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: publicKey } : {}, exitCode: 0, exit: () => { throw new Error("Unexpected process exit"); } };
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

test("deployment uploads the build-time public key as a required runtime binding", () => {
  assert.ok(syncFixture("pk_live_fixture").uploaded.includes("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"));
  assert.equal(syncFixture().exitCode, 1);
});

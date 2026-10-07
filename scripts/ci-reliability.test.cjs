const assert = require("node:assert/strict");
const { test } = require("node:test");
const { main: audit } = require("./ci-audit.cjs");
const { main: sync, failureKind } = require("./sync-worker-secrets.cjs");
const quiet = { log() {}, warn() {}, error() {} };
const clean = { status: 0, stdout: JSON.stringify({ metadata: { vulnerabilities: { moderate: 0, high: 0, critical: 0 } } }) };
const outage = { status: 1, stdout: JSON.stringify({ error: { code: "E503", summary: "Service Unavailable" } }) };

test("audit retries registry outages but never treats an unavailable audit as success", async () => {
  let calls = 0;
  const waits = [];
  assert.equal(await audit({ run: () => ++calls < 3 ? outage : clean, delay: async ms => waits.push(ms), console: quiet }), 0);
  assert.equal(calls, 3);
  assert.deepEqual(waits, [2000, 4000]);
  calls = 0;
  assert.equal(await audit({ run: () => { calls++; return outage; }, delay: async () => {}, console: quiet }), 1);
  assert.equal(calls, 3);
});

test("real advisories, invalid lockfiles, and malformed audit output block immediately", async () => {
  for (const result of [
    { status: 1, stdout: JSON.stringify({ metadata: { vulnerabilities: { moderate: 1, high: 0, critical: 0 } }, vulnerabilities: { example: { severity: "moderate" } } }) },
    { status: 1, stdout: JSON.stringify({ error: { code: "E400", summary: "Invalid package tree" } }) },
    { status: 0, stdout: "not an audit report" },
  ]) {
    let calls = 0;
    assert.equal(await audit({ run: () => { calls++; return result; }, console: quiet }), 1);
    assert.equal(calls, 1);
  }
});

const env = { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_fixture", INTEGRATION_CRON_SECRET: "private-cron-value" };
const existing = JSON.stringify(["CLERK_SECRET_KEY", "INTEGRATION_ENCRYPTION_KEY", "INTEGRATION_CRON_SECRET", "PUBLIC_APP_URL"].map(name => ({ name })));

test("secret upload retries the same bulk payload over stdin and never logs credentials", async () => {
  let uploads = 0;
  const messages = [];
  await sync({ env, delay: async () => {}, console: { log: m => messages.push(m), warn: m => messages.push(m) }, exec: (_command, args, options) => {
    assert.ok(!args.some(arg => arg.includes(env.INTEGRATION_CRON_SECRET)));
    assert.equal(options.timeout, 120000);
    if (args.includes("list")) return existing;
    assert.ok(args.includes("bulk"));
    assert.deepEqual(JSON.parse(options.input), { INTEGRATION_CRON_SECRET: env.INTEGRATION_CRON_SECRET });
    if (++uploads < 3) throw { stderr: `HTTP 503 ${env.INTEGRATION_CRON_SECRET}` };
    return "";
  } });
  assert.equal(uploads, 3);
  assert.ok(!messages.join(" ").includes(env.INTEGRATION_CRON_SECRET));
});

test("secret uploads fail closed on permissions, binding conflicts, exhausted outages, and incomplete configuration", async () => {
  for (const [error, expectedCalls] of [[{ stderr: "Authentication error [code: 10000] private-value" }, 1], [{ stderr: "Binding name conflict private-value" }, 1], [{ stderr: "HTTP 503 private-value" }, 3]]) {
    let uploads = 0;
    await assert.rejects(sync({ env, delay: async () => {}, console: quiet, exec: (_command, args) => {
      if (args.includes("list")) return existing;
      uploads++;
      throw error;
    } }), err => !err.message.includes("private-value"));
    assert.equal(uploads, expectedCalls);
  }
  let uploads = 0;
  for (const listed of ["[]", "invalid json", "{}"] ) {
    await assert.rejects(sync({ env, console: quiet, exec: (_command, args) => {
      if (args.includes("list")) return listed;
      uploads++;
    } }));
  }
  assert.equal(uploads, 0);
  assert.equal(failureKind({ code: "ETIMEDOUT" }), "temporary service failure");
});

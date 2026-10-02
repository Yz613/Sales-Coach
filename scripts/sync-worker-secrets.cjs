#!/usr/bin/env node
/**
 * Push GitHub Actions secrets onto the Cloudflare Worker. OpenNext does not
 * upload STRIPE_* / CLERK_SECRET_KEY just because they are in the job env.
 */
const { execFileSync } = require("child_process");

const ROOT = process.cwd();
const SECRET_NAMES = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "CLERK_SECRET_KEY",
  "INTEGRATION_ENCRYPTION_KEY",
  "INTEGRATION_CRON_SECRET",
  "PUBLIC_APP_URL",
  "BILLING_EXEMPT_ORG_IDS",
];
const OPTIONAL_SECRET_NAMES = [
  "GOOGLE_CALENDAR_CLIENT_ID", "GOOGLE_CALENDAR_CLIENT_SECRET",
  "MICROSOFT_CALENDAR_CLIENT_ID", "MICROSOFT_CALENDAR_CLIENT_SECRET",
  "CALENDLY_CLIENT_ID", "CALENDLY_CLIENT_SECRET",
];

function wrangler(args, input) {
  return execFileSync("npx", ["wrangler", ...args], {
    cwd: ROOT,
    encoding: "utf8",
    input,
    stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
  });
}

function existingSecretNames() {
  try {
    const raw = wrangler(["secret", "list", "--format", "json"]);
    const parsed = JSON.parse(raw);
    const rows = Array.isArray(parsed) ? parsed : parsed?.secrets || parsed?.result || [];
    return new Set(
      rows
        .map((row) => (typeof row === "string" ? row : row?.name || row?.binding))
        .filter(Boolean)
    );
  } catch (err) {
    console.warn("Could not list worker secret names.");
    return new Set();
  }
}

function putSecret(name, value) {
  try { wrangler(["secret", "put", name], value); }
  catch {
    console.error(`Could not upload ${name}. Inspect deployment access without exposing secret values.`);
    process.exit(1);
  }
}

const present = existingSecretNames();
let synced = 0;
// configure-worker-security.cjs binds the public key through Wrangler vars.
let missing = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() ? [] : ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"];

for (const name of [...SECRET_NAMES, ...OPTIONAL_SECRET_NAMES]) {
  const value = (process.env[name] || "").trim();
  if (value) {
    putSecret(name, value);
    console.log(`${name} synced to Cloudflare`);
    synced += 1;
    present.add(name);
    continue;
  }
  if (present.has(name)) {
    console.log(`${name} already present on the worker`);
    continue;
  }
  if (SECRET_NAMES.includes(name)) {
    missing.push(name);
    console.log(`${name} is not in GitHub Actions secrets and not on the worker`);
  }
}

if (missing.includes("STRIPE_SECRET_KEY")) {
  console.error("Hosted checkout will return 503 until STRIPE_SECRET_KEY is set.");
}

if (missing.some(name => ["CLERK_SECRET_KEY", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "INTEGRATION_ENCRYPTION_KEY", "INTEGRATION_CRON_SECRET", "PUBLIC_APP_URL"].includes(name))) {
  console.error("Required production security configuration is missing. Deployment stopped.");
  process.exitCode = 1;
}

console.log(`Synced ${synced} secret(s).`);

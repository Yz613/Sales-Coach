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
    console.warn("Could not list worker secrets:", err.stderr || err.message);
    return new Set();
  }
}

function putSecret(name, value) {
  wrangler(["secret", "put", name], value);
}

const present = existingSecretNames();
let synced = 0;
let missing = [];

for (const name of SECRET_NAMES) {
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
  missing.push(name);
  console.log(`${name} is not in GitHub Actions secrets and not on the worker`);
}

if (missing.includes("STRIPE_SECRET_KEY")) {
  console.error("Hosted checkout will return 503 until STRIPE_SECRET_KEY is set.");
}

console.log(`Synced ${synced} secret(s).`);

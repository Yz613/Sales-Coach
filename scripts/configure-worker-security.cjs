#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const file = path.resolve(__dirname, "..", "wrangler.jsonc");
const original = fs.readFileSync(file, "utf8");
let source = original;

// Hosted operators can explicitly opt out when their identity-provider plan lacks MFA.
// The checked-in template and application policy continue to require MFA by default.
const policy = (process.env.REQUIRE_MFA || "").trim().toLowerCase();
if (policy) {
  if (!["true", "false"].includes(policy)) {
    console.error("REQUIRE_MFA must be true or false.");
    process.exit(1);
  }
  if (!/"REQUIRE_MFA"\s*:\s*"(?:true|false)"/.test(source)) {
    console.error("Worker configuration is missing the MFA policy.");
    process.exit(1);
  }
  source = source.replace(/("REQUIRE_MFA"\s*:\s*)"(?:true|false)"/, `$1"${policy}"`);
  console.log(`Worker MFA requirement: ${policy}`);
} else {
  console.log("Worker MFA requirement: checked-in default");
}

// Clerk publishes this key in the browser. Use a runtime variable so it cannot
// collide with an existing plain-text binding when syncing private secrets.
const publicKey = (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "").trim();
if (publicKey) {
  if (!/^pk_(?:test|live)_\S+$/.test(publicKey)) {
    console.error("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is invalid.");
    process.exit(1);
  }
  const binding = `"NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY": ${JSON.stringify(publicKey)}`;
  const existing = /"NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"\s*:\s*"(?:[^"\\]|\\.)*"/;
  if (existing.test(source)) source = source.replace(existing, () => binding);
  else if (/"vars"\s*:\s*\{/.test(source)) source = source.replace(/("vars"\s*:\s*\{)/, match => `${match}\n\t\t${binding},`);
  else {
    console.error("Worker configuration is missing runtime variables.");
    process.exit(1);
  }
  console.log("Clerk public key configured as a runtime variable.");
}
if (source !== original) fs.writeFileSync(file, source);

#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

// Hosted operators can explicitly opt out when their identity-provider plan lacks MFA.
// The checked-in template and application policy continue to require MFA by default.
const policy = (process.env.REQUIRE_MFA || "").trim().toLowerCase();
if (policy) {
  if (!["true", "false"].includes(policy)) {
    console.error("REQUIRE_MFA must be true or false.");
    process.exit(1);
  }
  const file = path.resolve(__dirname, "..", "wrangler.jsonc");
  const source = fs.readFileSync(file, "utf8");
  if (!/"REQUIRE_MFA"\s*:\s*"(?:true|false)"/.test(source)) {
    console.error("Worker configuration is missing the MFA policy.");
    process.exit(1);
  }
  fs.writeFileSync(file, source.replace(/("REQUIRE_MFA"\s*:\s*)"(?:true|false)"/, `$1"${policy}"`));
  console.log(`Worker MFA requirement: ${policy}`);
} else {
  console.log("Worker MFA requirement: checked-in default");
}

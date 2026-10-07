#!/usr/bin/env node
/** Upload worker secrets over stdin, preserving optional secrets already on the worker. */
const { execFileSync } = require("node:child_process");
const OAUTH_APPS = require("../src/lib/integrations/oauth-providers.json");
const SECRET_NAMES = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "CLERK_SECRET_KEY", "INTEGRATION_ENCRYPTION_KEY", "INTEGRATION_CRON_SECRET", "PUBLIC_APP_URL", "BILLING_EXEMPT_ORG_IDS"];
const OPTIONAL_SECRET_NAMES = Object.values(OAUTH_APPS).flatMap(app => [`${app.prefix}_CLIENT_ID`, `${app.prefix}_CLIENT_SECRET`]);
const REQUIRED = ["CLERK_SECRET_KEY", "INTEGRATION_ENCRYPTION_KEY", "INTEGRATION_CRON_SECRET", "PUBLIC_APP_URL"];

function failureKind(error) {
  // Inspect diagnostics internally. Never print Wrangler output, which can contain secret values.
  const detail = `${error.code || ""} ${error.stderr || ""} ${error.stdout || ""}`;
  if (/authentication|unauthorized|forbidden|\b(?:401|403|10000|10001|9109)\b/i.test(detail)) return "authorization";
  if (/\b(?:429|5\d\d|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|ENETUNREACH)\b|fetch failed|timed? ?out|rate.?limit|temporarily unavailable|internal server error/i.test(detail)) return "temporary service failure";
  return "configuration or command failure";
}

async function main(options = {}) {
  const env = options.env || process.env;
  const exec = options.exec || execFileSync;
  const log = options.console || console;
  const delay = options.delay || (ms => new Promise(resolve => setTimeout(resolve, ms)));
  async function wrangler(args, input) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return exec(process.platform === "win32" ? "npx.cmd" : "npx", ["--no-install", "wrangler", ...args], {
          cwd: process.cwd(), env, encoding: "utf8", input, timeout: 120000,
          stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
        });
      } catch (error) {
        const kind = failureKind(error);
        if (kind !== "temporary service failure" || attempt === 2) {
          throw new Error(`Worker secret ${args[1]} failed: ${kind}. Check Cloudflare access and worker binding names. Raw output was withheld to protect credentials.`);
        }
        log.warn(`Worker secret ${args[1]} hit a temporary service failure; retrying (${attempt + 2}/3).`);
        await delay(2000 * (attempt + 1));
      }
    }
  }

  if (!env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim()) throw new Error("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required. Deployment stopped before uploading secrets.");
  const raw = await wrangler(["secret", "list", "--format", "json"]);
  let rows;
  try {
    const parsed = JSON.parse(raw);
    rows = Array.isArray(parsed) ? parsed : parsed?.secrets || parsed?.result;
    if (!Array.isArray(rows)) throw new Error();
  } catch { throw new Error("Could not read worker secret names. Deployment stopped before uploading secrets."); }
  const present = new Set(rows.map(row => typeof row === "string" ? row : row?.name || row?.binding).filter(Boolean));
  const values = {};
  for (const name of [...SECRET_NAMES, ...OPTIONAL_SECRET_NAMES]) {
    const value = (env[name] || "").trim();
    if (value) values[name] = value;
  }
  const missing = REQUIRED.filter(name => !values[name] && !present.has(name));
  if (missing.length) throw new Error(`Required production security configuration is missing: ${missing.join(", ")}. Deployment stopped before uploading secrets.`);
  if (!values.STRIPE_SECRET_KEY && !present.has("STRIPE_SECRET_KEY")) log.warn("Hosted checkout will return 503 until STRIPE_SECRET_KEY is set.");
  // A single bulk update avoids deploying a worker version for every individual secret.
  // Repeating the same update after a transient failure is idempotent.
  if (Object.keys(values).length) await wrangler(["secret", "bulk"], JSON.stringify(values));
  log.log(`Synced ${Object.keys(values).length} secret(s). Existing secrets without supplied replacements were preserved.`);
}

module.exports = { main, failureKind };
if (require.main === module) main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});

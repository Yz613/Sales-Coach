/** Check the deployed bindings and authorization without logging credentials or private response bodies. */
async function main(options = {}) {
  const env = options.env || process.env;
  const fetch = options.fetch || globalThis.fetch;
  const delay = options.delay || (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const origin = new URL(env.PUBLIC_APP_URL || "").origin;
  const secret = env.INTEGRATION_CRON_SECRET || "";
  if (!origin.startsWith("https://") || secret.length < 32) throw new Error("Deployment verification configuration is missing.");
  // Edge locations may briefly serve the preceding version during a rollout.
  let verified = false;
  let failure = "route protections";
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const run = await fetch(`${origin}/app/api/jobs/run?check=health`, {
        method: "POST", headers: { Authorization: `Bearer ${secret}` },
        cache: "no-store", redirect: "error", signal: AbortSignal.timeout(30000),
      });
      const result = await run.json().catch(() => null);
      if (run.status !== 200 || result?.healthy !== true) {
        failure = `authenticated database health probe (HTTP ${run.status})`;
        await run.body?.cancel().catch(() => {});
        if (attempt < 4) await delay(10000);
        continue;
      }
      let protectedRoutes = true;
      for (const route of ["/app/api/conversations", "/app/api/integrations", "/app/api/admin/settings"]) {
        const response = await fetch(`${origin}${route}`, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(30000) });
        if (response.status !== 401 || !response.headers.get("cache-control")?.includes("no-store") || response.headers.get("x-content-type-options") !== "nosniff") protectedRoutes = false;
      }
      const duplicate = await fetch(`${origin}/app/app/sign-in?deployment_check=1`, { cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(30000) });
      const target = new URL(duplicate.headers.get("location") || "/", origin);
      const recovery = await fetch(`${origin}/app/session-recovery`, { cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(30000) });
      // Exercise server auth, rather than only middleware's anonymous rejection path.
      const role = await fetch(`${origin}/app/api/auth/role`, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(30000) });
      const auth = await role.json().catch(() => null);
      const serverAuthHealthy = role.status === 200 && auth?.userId === null && auth?.isClerkConfigured === true && !auth?.authenticationIssue && !auth?.error;
      // An invalid plan never creates a checkout. Its redirect proves security configuration passed.
      const configuration = await fetch(`${origin}/app/api/billing/checkout?plan=deployment_invalid`, { cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(30000) });
      const configurationHealthy = configuration.status === 303 && new URL(configuration.headers.get("location") || "/", origin).hash === "#pricing";
      if (protectedRoutes && serverAuthHealthy && configurationHealthy && duplicate.status === 307 && target.pathname === "/app/sign-in" && target.searchParams.get("deployment_check") === "1" && recovery.status === 200) {
        verified = true;
        break;
      }
      failure = "server authentication, runtime configuration, or route protections";
    } catch {
      // A connection reset or timeout during rollout is retryable; never log request secrets.
      failure = "deployment probe connection or timeout";
    }
    if (attempt < 4) await delay(10000);
  }
  if (!verified) throw new Error(`Deployed ${failure} failed verification after 5 attempts.`);
  // Creating an unpaid session verifies the actual payment links without charging a card.
  for (const plan of ["coach", "team"]) {
    const checkout = await fetch(`${origin}/app/api/billing/checkout?plan=${plan}`, { cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(30000) });
    let destination;
    try { destination = new URL(checkout.headers.get("location") || ""); } catch { /* checked below */ }
    if (checkout.status !== 303 || destination?.protocol !== "https:" || destination.hostname !== "checkout.stripe.com") {
      throw new Error(`Hosted ${plan} checkout failed verification (HTTP ${checkout.status}). Check Stripe credentials and billing.checkout_failed worker logs.`);
    }
  }
  console.log("Deployed authenticated health probe, database schema, server authentication, runtime configuration, API authorization, sign-in redirects, and both hosted checkouts verified.");
}
module.exports = { main };
if (require.main === module) main().catch(error => {
  console.error(error instanceof Error ? error.message : "Deployment verification failed.");
  process.exitCode = 1;
});

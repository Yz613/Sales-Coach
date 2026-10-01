/** Check the deployed bindings and authorization without logging credentials or private response bodies. */
async function main() {
  const origin = new URL(process.env.PUBLIC_APP_URL || "").origin;
  const secret = process.env.INTEGRATION_CRON_SECRET || "";
  if (!origin.startsWith("https://") || secret.length < 32) throw new Error("Deployment verification configuration is missing.");
  const run = await fetch(`${origin}/app/api/jobs/run`, {
    method: "POST", headers: { Authorization: `Bearer ${secret}` },
    redirect: "error", signal: AbortSignal.timeout(60000),
  });
  if (run.status !== 200) throw new Error(`Authenticated job runner returned HTTP ${run.status}.`);
  const result = await run.json();
  if (!Array.isArray(result.jobs)) throw new Error("Job runner returned an unexpected response.");
  // Edge locations may briefly serve the preceding version during a rollout.
  let verified = false;
  for (let attempt = 0; attempt < 5; attempt++) {
    let protectedRoutes = true;
    for (const route of ["/app/api/conversations", "/app/api/integrations", "/app/api/admin/settings"]) {
      const response = await fetch(`${origin}${route}`, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(30000) });
      if (response.status !== 401 || !response.headers.get("cache-control")?.includes("no-store") || response.headers.get("x-content-type-options") !== "nosniff") protectedRoutes = false;
    }
    const duplicate = await fetch(`${origin}/app/app/sign-in?deployment_check=1`, { cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(30000) });
    const target = new URL(duplicate.headers.get("location") || "/", origin);
    const recovery = await fetch(`${origin}/app/session-recovery`, { cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(30000) });
    if (protectedRoutes && duplicate.status === 307 && target.pathname === "/app/sign-in" && target.searchParams.get("deployment_check") === "1" && recovery.status === 200) {
      verified = true;
      break;
    }
    if (attempt < 4) await new Promise(resolve => setTimeout(resolve, 10000));
  }
  if (!verified) throw new Error("Deployed authorization or sign-in redirect protections failed verification.");
  console.log("Deployed job runner, database schema, API authorization, and sign-in redirect recovery verified.");
}
main().catch(error => {
  console.error(error instanceof Error ? error.message : "Deployment verification failed.");
  process.exitCode = 1;
});

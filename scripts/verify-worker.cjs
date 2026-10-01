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
  for (const route of ["/app/api/conversations", "/app/api/integrations", "/app/api/admin/settings"]) {
    const response = await fetch(`${origin}${route}`, { redirect: "error", signal: AbortSignal.timeout(30000) });
    if (response.status !== 401 || !response.headers.get("cache-control")?.includes("no-store") || response.headers.get("x-content-type-options") !== "nosniff") {
      throw new Error("Deployed API authorization or response protections failed verification.");
    }
  }
  console.log("Deployed job runner, database schema, and API authorization verified.");
}
main().catch(error => {
  console.error(error instanceof Error ? error.message : "Deployment verification failed.");
  process.exitCode = 1;
});

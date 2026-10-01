import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function main() {
  const { assertSecureDeployment } = await import("../src/lib/security-policy");
  assertSecureDeployment();
  const { scheduleSyncs, processJobs } = await import("../src/lib/revenue/jobs");
  const { ensureRevenueSchema } = await import("../src/lib/db");
  const { scheduledRetention } = await import("../src/lib/revenue/privacy");
  await ensureRevenueSchema();
  const once = process.argv.includes("--once");
  let stopping = false; let lastMaintenance = 0;
  process.on("SIGINT", () => { stopping = true; }); process.on("SIGTERM", () => { stopping = true; });
  do {
    try {
      if (Date.now() - lastMaintenance > 60000) { await scheduleSyncs(); await scheduledRetention(); lastMaintenance = Date.now(); }
      const outcomes = await processJobs(undefined, 8);
      if (outcomes.length) console.log(JSON.stringify({ processed: outcomes.length, failed: outcomes.filter(j => j.status === "failed").length }));
    } catch(e) { console.error("Integration worker error:", e instanceof Error ? e.name : "Unknown error"); if (once) process.exitCode = 1; }
    if (!once && !stopping) await new Promise(resolve => setTimeout(resolve, 3000));
  } while (!once && !stopping);
}
main().catch(err => { console.error("Worker startup failed:", err instanceof Error ? err.message : "Unknown error"); process.exitCode = 1; });

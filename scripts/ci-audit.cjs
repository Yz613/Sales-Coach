#!/usr/bin/env node
/** Keep real advisories blocking while retrying temporary npm registry failures. */
const { spawnSync } = require("node:child_process");
async function main(options = {}) {
  const run = options.run || spawnSync;
  const log = options.console || console;
  const delay = options.delay || (ms => new Promise(resolve => setTimeout(resolve, ms)));
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = run(process.platform === "win32" ? "npm.cmd" : "npm", ["audit", "--json", "--audit-level=moderate", "--omit=dev"], { encoding: "utf8", timeout: 120000 });
    let report;
    try { report = JSON.parse(result.stdout); } catch { /* an unavailable registry may return no JSON */ }
    const counts = report?.metadata?.vulnerabilities;
    if (report && !report.error && counts && ["moderate", "high", "critical"].some(level => counts[level] > 0)) {
      log.error(JSON.stringify(report, null, 2));
      return 1;
    }
    if (result.status === 0 && report && !report.error && counts) {
      log.log("Production dependency audit passed (no moderate, high, or critical advisories).");
      return 0;
    }
    const code = String(report?.error?.code || result.error?.code || "");
    const detail = `${code} ${report?.error?.summary || ""} ${result.stderr || ""}`;
    const transient = /\b(?:E(?:429|5\d\d)|429|5\d\d|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|ENETUNREACH)\b|fetch failed|timed? ?out|temporarily unavailable/i.test(detail);
    if (!transient || attempt === 2) {
      log.error(`Dependency audit could not complete${code ? ` (${code})` : ""}. CI remains blocked; check the registry and lockfile.`);
      return 1;
    }
    log.warn(`npm registry temporarily unavailable; retrying audit (${attempt + 2}/3).`);
    await delay(2000 * (attempt + 1));
  }
}
module.exports = { main };
if (require.main === module) main().then(code => { process.exitCode = code; }).catch(() => { console.error("Dependency audit failed."); process.exitCode = 1; });

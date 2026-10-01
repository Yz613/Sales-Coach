const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

// Database regressions must never use the developer's actual workspace data.
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sales-coach-regression-"));
try {
  const result = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "test:unit"], {
    stdio: "inherit",
    env: { ...process.env, SALES_COACH_DB_PATH: path.join(directory, "test.db"), CALL_AUDIO_DIR: path.join(directory, "audio"), INTEGRATION_KEY_FILE: path.join(directory, "integration.key") },
  });
  if (result.error) console.error(result.error.message);
  process.exitCode = result.status ?? 1;
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}

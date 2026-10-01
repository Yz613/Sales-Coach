import fs from "node:fs";
import path from "node:path";
import { isSecretSetting, openSetting, sealSetting } from "../src/lib/setting-secrets";
import { encryptionKey } from "../src/lib/revenue/security";

type Result = { results?: Record<string, unknown>[]; meta?: { changes?: number }; success?: boolean };
export type Query = (sql: string, params?: string[]) => Promise<Result>;

/** Run after deploying encrypted-setting support. Never print values or query errors. */
export async function encryptD1Settings(query: Query): Promise<{ encryptedSettings: number }> {
  encryptionKey();
  const read = await query("SELECT key, value FROM app_settings");
  const rows = (read.results || []).map(row => ({ key: String(row.key), value: String(row.value) }));
  // Validate the original key before any writes, including on repeat deployments.
  for (const row of rows) {
    if (isSecretSetting(row.key) && row.value.startsWith("v1.")) openSetting(row.key, row.value);
  }
  let encryptedSettings = 0;
  for (const row of rows) {
    if (!isSecretSetting(row.key) || !row.value || row.value.startsWith("v1.")) continue;
    const result = await query("UPDATE app_settings SET value = ?, updated_at = ? WHERE key = ? AND value = ?", [
      sealSetting(row.key, row.value), new Date().toISOString(), row.key, row.value,
    ]);
    encryptedSettings += result.meta?.changes || 0;
  }
  const verification = await query("SELECT key, value FROM app_settings");
  for (const row of verification.results || []) {
    const key = String(row.key); const value = String(row.value);
    if (!isSecretSetting(key) || !value) continue;
    if (!value.startsWith("v1.")) throw new Error("A legacy secret setting remains unencrypted.");
    openSetting(key, value);
  }
  return { encryptedSettings };
}

async function main() {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
  const config = fs.readFileSync(path.resolve(process.cwd(), "wrangler.jsonc"), "utf8");
  const database = config.match(/"database_id"\s*:\s*"([0-9a-f-]{36})"/i)?.[1];
  if (!account || !token || !database) throw new Error("Missing deployment configuration.");
  const query: Query = async (sql, params = []) => {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/d1/database/${database}/query`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ sql, params }), redirect: "error", signal: AbortSignal.timeout(30000),
    });
    const body = await response.json() as { success?: boolean; result?: Result[] };
    // Provider failures may contain SQL parameters. Never log the response body.
    if (!response.ok || !body.success || body.result?.[0]?.success !== true) throw new Error("D1 query failed.");
    return body.result[0];
  };
  console.log(JSON.stringify(await encryptD1Settings(query)));
}

if (require.main === module) main().catch(() => {
  console.error("D1 settings encryption failed. Check deployment access and the original encryption key; secret values are suppressed.");
  process.exitCode = 1;
});

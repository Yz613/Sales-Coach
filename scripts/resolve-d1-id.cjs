#!/usr/bin/env node
/**
 * GitHub Actions deploy uses a placeholder D1 id in wrangler.jsonc.
 * Replace it with the existing `sales-coach-db` UUID from the Cloudflare account.
 */
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const WRANGLER_PATH = path.join(ROOT, "wrangler.jsonc");
const DB_NAME = "sales-coach-db";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function wrangler(args) {
  return execFileSync("npx", ["wrangler", ...args], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function parseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("[") >= 0 && (raw.indexOf("{") < 0 || raw.indexOf("[") < raw.indexOf("{"))
      ? raw.indexOf("[")
      : raw.indexOf("{");
    if (start < 0) return null;
    return JSON.parse(raw.slice(start));
  }
}

function asList(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];
  if (Array.isArray(data.result)) return data.result;
  if (Array.isArray(data.databases)) return data.databases;
  if (Array.isArray(data.d1_databases)) return data.d1_databases;
  return [data];
}

function idFromRow(row) {
  if (!row || typeof row !== "object") return "";
  return row.uuid || row.id || row.database_id || "";
}

function findDatabaseId() {
  const listed = asList(parseJson(wrangler(["d1", "list", "--json"])));
  const match = listed.find((row) => row && (row.name === DB_NAME || row.database_name === DB_NAME));
  const listedId = idFromRow(match);
  if (UUID_RE.test(listedId)) return listedId;

  try {
    const info = parseJson(wrangler(["d1", "info", DB_NAME, "--json"]));
    const infoId = idFromRow(info) || idFromRow(asList(info)[0]);
    if (UUID_RE.test(infoId)) return infoId;
  } catch {
    // Database may not exist yet.
  }

  const created = wrangler(["d1", "create", DB_NAME]);
  const createdId = (created.match(UUID_RE) || [])[0] || "";
  if (UUID_RE.test(createdId)) return createdId;
  throw new Error(`Could not resolve D1 id for ${DB_NAME}. wrangler output:\n${created}`);
}

const wranglerText = fs.readFileSync(WRANGLER_PATH, "utf8");
const current = (wranglerText.match(/"database_id"\s*:\s*"([^"]+)"/) || [])[1] || "";
if (UUID_RE.test(current)) {
  console.log(`D1 ${DB_NAME} already has database_id ${current}`);
  process.exit(0);
}

const databaseId = findDatabaseId();
const next = wranglerText.replace(/"database_id"\s*:\s*"[^"]+"/, `"database_id": "${databaseId}"`);
if (next === wranglerText) {
  throw new Error("wrangler.jsonc does not contain a database_id field to replace.");
}
fs.writeFileSync(WRANGLER_PATH, next);
console.log(`Resolved D1 ${DB_NAME} database_id ${databaseId}`);

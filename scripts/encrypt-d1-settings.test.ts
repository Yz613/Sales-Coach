import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import Database from "better-sqlite3";
import { encryptD1Settings, type Query } from "./encrypt-d1-settings";
import { openSetting, sealSetting } from "../src/lib/setting-secrets";

test("D1 migration encrypts secrets, preserves other settings, and rejects the wrong key before writes", async () => {
  const original = process.env.INTEGRATION_ENCRYPTION_KEY;
  process.env.INTEGRATION_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  const database = new Database(":memory:");
  try {
    database.exec("CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT)");
    database.prepare("INSERT INTO app_settings (key,value) VALUES (?,?)").run("org_one:ai_api_key", "legacy-test-credential");
    database.prepare("INSERT INTO app_settings (key,value) VALUES (?,?)").run("org_one:theme", "light");
    database.prepare("INSERT INTO app_settings (key,value) VALUES (?,?)").run("org_one:resend_api_key", sealSetting("org_one:resend_api_key", "existing-test-credential"));
    let writes = 0;
    const query: Query = async (sql, params = []) => {
      if (sql.startsWith("SELECT")) return { results: database.prepare(sql).all(...params) as Record<string, unknown>[] };
      writes++;
      return { meta: { changes: database.prepare(sql).run(...params).changes } };
    };
    assert.deepEqual(await encryptD1Settings(query), { encryptedSettings: 1 });
    const encrypted = database.prepare("SELECT value FROM app_settings WHERE key=?").get("org_one:ai_api_key") as { value: string };
    assert.equal(openSetting("org_one:ai_api_key", encrypted.value), "legacy-test-credential");
    assert.equal((database.prepare("SELECT value FROM app_settings WHERE key=?").get("org_one:theme") as { value: string }).value, "light");
    assert.deepEqual(await encryptD1Settings(query), { encryptedSettings: 0 });
    database.prepare("INSERT INTO app_settings (key,value) VALUES (?,?)").run("org_two:ai_api_key", "another-test-credential");
    process.env.INTEGRATION_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    const previousWrites = writes;
    await assert.rejects(encryptD1Settings(query));
    assert.equal(writes, previousWrites);
  } finally {
    database.close();
    if (original === undefined) delete process.env.INTEGRATION_ENCRYPTION_KEY;
    else process.env.INTEGRATION_ENCRYPTION_KEY = original;
  }
});

test("D1 migration preserves a concurrent write and rejects remaining plaintext", async () => {
  const original = process.env.INTEGRATION_ENCRYPTION_KEY;
  process.env.INTEGRATION_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  const database = new Database(":memory:");
  try {
    database.exec("CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT)");
    database.prepare("INSERT INTO app_settings (key,value) VALUES (?,?)").run("org_one:ai_api_key", "original-test-credential");
    const query: Query = async (sql, params = []) => {
      if (sql.startsWith("SELECT")) return { results: database.prepare(sql).all(...params) as Record<string, unknown>[] };
      database.prepare("UPDATE app_settings SET value=? WHERE key=?").run("concurrent-test-credential", "org_one:ai_api_key");
      return { meta: { changes: database.prepare(sql).run(...params).changes } };
    };
    await assert.rejects(encryptD1Settings(query), /remains unencrypted/);
    assert.equal((database.prepare("SELECT value FROM app_settings WHERE key=?").get("org_one:ai_api_key") as { value: string }).value, "concurrent-test-credential");
  } finally {
    database.close();
    if (original === undefined) delete process.env.INTEGRATION_ENCRYPTION_KEY;
    else process.env.INTEGRATION_ENCRYPTION_KEY = original;
  }
});

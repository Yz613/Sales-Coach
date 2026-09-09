import * as schema from "./schema";

let _db: any = null;

export function getDb() {
  if (_db) return _db;

  // 1. Try Cloudflare Worker D1 context
  try {
    const { getCloudflareContext } = require("@opennextjs/cloudflare");
    const ctx = getCloudflareContext();
    if (ctx && ctx.env && ctx.env.DB) {
      const { drizzle } = require("drizzle-orm/d1");
      try {
        ctx.env.DB.prepare("ALTER TABLE evaluations ADD COLUMN extended_review TEXT").run();
      } catch {
        // Column already exists, or D1 rejected a duplicate alter.
      }
      _db = drizzle(ctx.env.DB, { schema });
      return _db;
    }
  } catch (e) {
    // Not running inside Cloudflare Worker or during build
  }

  // 2. Fallback to better-sqlite3 for local dev / scripts / tests
  try {
    const Database = require("better-sqlite3");
    const { drizzle } = require("drizzle-orm/better-sqlite3");
    const path = require("path");
    const dbPath = path.resolve(process.cwd(), "sales_coach.db");
    const sqlite = new Database(dbPath);
    sqlite.pragma("journal_mode = WAL");
    const fs = require("fs");
    const schemaPath = path.resolve(process.cwd(), "schema.sql");
    if (fs.existsSync(schemaPath)) {
      sqlite.exec(fs.readFileSync(schemaPath, "utf8"));
    }
    try {
      const cols = sqlite.prepare("PRAGMA table_info(evaluations)").all();
      if (!cols.some((c: { name: string }) => c.name === "extended_review")) {
        sqlite.exec("ALTER TABLE evaluations ADD COLUMN extended_review TEXT");
      }
    } catch {
      // Table may not exist yet; schema.sql creates it with the column.
    }
    _db = drizzle(sqlite, { schema });
    return _db;
  } catch (e) {
    console.warn("Could not initialize local SQLite, returning fallback query proxy:", e);
  }

  return null;
}

// Proxy exported as db so syntax like db.select().from(...) works seamlessly
export const db = new Proxy({} as any, {
  get(_target, prop) {
    const instance = getDb();
    if (!instance) {
      throw new Error("Database not initialized");
    }
    const val = instance[prop];
    return typeof val === "function" ? val.bind(instance) : val;
  }
});

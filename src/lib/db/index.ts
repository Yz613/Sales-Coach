import * as schema from "./schema";

const TENANT_TABLES = [
  "reps",
  "calls",
  "evaluations",
  "rep_snapshots",
  "scripts",
  "rep_personas",
] as const;

function addOrgIdColumnSqlite(sqlite: {
  prepare: (sql: string) => { all: () => { name: string }[] };
  exec: (sql: string) => unknown;
}) {
  for (const table of TENANT_TABLES) {
    try {
      const cols = sqlite.prepare(`PRAGMA table_info(${table})`).all();
      if (!cols.some((c) => c.name === "org_id")) {
        sqlite.exec(`ALTER TABLE ${table} ADD COLUMN org_id TEXT NOT NULL DEFAULT 'local'`);
      }
      sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_${table}_org_id ON ${table}(org_id)`);
    } catch {
      // Table may not exist yet; schema.sql creates it with the column.
    }
  }
}

async function addOrgIdColumnD1(d1: { prepare: (sql: string) => { run: () => Promise<unknown> } }) {
  for (const table of TENANT_TABLES) {
    try {
      await d1.prepare(`ALTER TABLE ${table} ADD COLUMN org_id TEXT NOT NULL DEFAULT 'local'`).run();
    } catch {
      // Duplicate column on already-migrated D1 databases.
    }
    try {
      await d1.prepare(`CREATE INDEX IF NOT EXISTS idx_${table}_org_id ON ${table}(org_id)`).run();
    } catch {
      // Index may already exist.
    }
  }
}

let _db: any = null;
let _d1MigratePromise: Promise<void> | null = null;

export async function ensureD1Migrated(): Promise<void> {
  getDb();
  if (_d1MigratePromise) await _d1MigratePromise;
}

function initLocalSqlite() {
  const Database = require("better-sqlite3");
  const { drizzle } = require("drizzle-orm/better-sqlite3");
  const path = require("path");
  const fs = require("fs");
  const dbPath = path.resolve(process.cwd(), "sales_coach.db");
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  addOrgIdColumnSqlite(sqlite);
  const schemaPath = path.resolve(process.cwd(), "schema.sql");
  if (fs.existsSync(schemaPath)) {
    sqlite.exec(fs.readFileSync(schemaPath, "utf8"));
  }
  addOrgIdColumnSqlite(sqlite);
  try {
    const cols = sqlite.prepare("PRAGMA table_info(evaluations)").all();
    if (!cols.some((c: { name: string }) => c.name === "extended_review")) {
      sqlite.exec("ALTER TABLE evaluations ADD COLUMN extended_review TEXT");
    }
    if (!cols.some((c: { name: string }) => c.name === "script_divergence")) {
      sqlite.exec("ALTER TABLE evaluations ADD COLUMN script_divergence TEXT");
    }
  } catch {
    // Table may not exist yet; schema.sql creates it with the column.
  }
  return drizzle(sqlite, { schema });
}

export function getDb() {
  if (_db) return _db;

  const path = require("path");
  const fs = require("fs");
  const dbPath = path.resolve(process.cwd(), "sales_coach.db");
  // `next dev` can inject an empty D1 binding. Prefer a seeded local file when it exists.
  if (fs.existsSync(dbPath)) {
    try {
      _db = initLocalSqlite();
      return _db;
    } catch (e) {
      console.warn("Local SQLite init failed, trying D1:", e);
    }
  }

  try {
    const { getCloudflareContext } = require("@opennextjs/cloudflare");
    const ctx = getCloudflareContext();
    if (ctx && ctx.env && ctx.env.DB) {
      const { drizzle } = require("drizzle-orm/d1");
      if (!_d1MigratePromise) {
        _d1MigratePromise = addOrgIdColumnD1(ctx.env.DB).catch((err) => {
          _d1MigratePromise = null;
          throw err;
        });
      }
      _db = drizzle(ctx.env.DB, { schema });
      return _db;
    }
  } catch {
    // Not running inside Cloudflare Worker or during build
  }

  try {
    _db = initLocalSqlite();
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

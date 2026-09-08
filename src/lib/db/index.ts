import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";

// Initialize SQLite database file in project root
const dbPath = path.resolve(process.cwd(), "sales_coach.db");
const sqlite = new Database(dbPath);

// Enable WAL mode for performance
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite, { schema });

// Auto initialize tables if not present
export function initDb() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS reps (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL,
      avatar_url TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS calls (
      id TEXT PRIMARY KEY,
      rep_id TEXT NOT NULL,
      prospect_company TEXT NOT NULL,
      prospect_name TEXT NOT NULL,
      call_stage TEXT NOT NULL,
      core_outcome TEXT NOT NULL,
      duration_seconds INTEGER NOT NULL,
      transcript_text TEXT NOT NULL,
      audio_url TEXT,
      status TEXT NOT NULL DEFAULT 'completed',
      created_at TEXT NOT NULL,
      FOREIGN KEY (rep_id) REFERENCES reps(id)
    );

    CREATE TABLE IF NOT EXISTS evaluations (
      id TEXT PRIMARY KEY,
      call_id TEXT NOT NULL,
      rep_id TEXT NOT NULL,
      bottom_line TEXT NOT NULL,
      pain_status TEXT NOT NULL,
      pain_evidence TEXT NOT NULL,
      budget_status TEXT NOT NULL,
      budget_evidence TEXT NOT NULL,
      decision_status TEXT NOT NULL,
      decision_evidence TEXT NOT NULL,
      script_adherence_score INTEGER NOT NULL,
      script_feedback TEXT NOT NULL,
      script_divergence TEXT,
      missed_opportunities TEXT NOT NULL,
      top_fixes TEXT NOT NULL,
      raw_markdown TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (call_id) REFERENCES calls(id),
      FOREIGN KEY (rep_id) REFERENCES reps(id)
    );

    CREATE TABLE IF NOT EXISTS rep_snapshots (
      id TEXT PRIMARY KEY,
      rep_id TEXT NOT NULL,
      overall_trajectory TEXT NOT NULL,
      manager_rationale TEXT NOT NULL,
      top_active_struggle TEXT NOT NULL,
      recent_script_score INTEGER NOT NULL,
      last_updated TEXT NOT NULL,
      FOREIGN KEY (rep_id) REFERENCES reps(id)
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scripts (
      id TEXT PRIMARY KEY,
      stage TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      key_milestones TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rep_personas (
      id TEXT PRIMARY KEY,
      rep_id TEXT NOT NULL,
      experience_level TEXT NOT NULL,
      coaching_tone TEXT NOT NULL,
      known_blindspots TEXT NOT NULL,
      strengths TEXT NOT NULL,
      manager_notes TEXT NOT NULL,
      target_quota TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (rep_id) REFERENCES reps(id)
    );
  `);

  runMigrations();
}

// Lightweight, idempotent column migrations for databases created before a
// column was introduced. Uses CREATE TABLE IF NOT EXISTS semantics elsewhere,
// so evolving columns must be added explicitly here.
function runMigrations() {
  const evalColumns = sqlite
    .prepare("PRAGMA table_info(evaluations)")
    .all() as { name: string }[];

  if (!evalColumns.some((c) => c.name === "script_divergence")) {
    sqlite.exec("ALTER TABLE evaluations ADD COLUMN script_divergence TEXT");
  }
}

// Run table creation on import
initDb();

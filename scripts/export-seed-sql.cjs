// Dev/verification helper: export the locally seeded better-sqlite3 DB into
// INSERT statements so the same data can be loaded into a (local or remote) D1.
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const db = new Database(path.resolve(process.cwd(), "sales_coach.db"), { readonly: true });

const tables = [
  "reps",
  "scripts",
  "rep_personas",
  "calls",
  "evaluations",
  "rep_snapshots",
  "app_settings",
];

function lit(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  if (typeof v === "bigint") return String(v);
  return "'" + String(v).replace(/'/g, "''") + "'";
}

const out = [];
for (const t of tables) {
  const rows = db.prepare(`SELECT * FROM ${t}`).all();
  for (const row of rows) {
    const cols = Object.keys(row);
    const vals = cols.map((c) => lit(row[c]));
    out.push(
      `INSERT INTO ${t} (${cols.join(", ")}) VALUES (${vals.join(", ")});`
    );
  }
}

const target = process.argv[2] || "/tmp/seed_d1.sql";
fs.writeFileSync(target, out.join("\n") + "\n");
console.log(`Wrote ${out.length} INSERT statements to ${target}`);

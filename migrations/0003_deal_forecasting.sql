-- Additive; safe to rerun on SQLite and Cloudflare D1.
CREATE TABLE IF NOT EXISTS deal_reviews (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL, deal_id TEXT NOT NULL, category TEXT NOT NULL,
  probability INTEGER, next_step TEXT NOT NULL DEFAULT '', next_step_date TEXT,
  playbook TEXT NOT NULL DEFAULT '{}', revision INTEGER NOT NULL, updated_by TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_deal_reviews_org_deal ON deal_reviews(org_id, deal_id);
CREATE TABLE IF NOT EXISTS forecast_submissions (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL, period TEXT NOT NULL, owner TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL DEFAULT '', target TEXT, notes TEXT NOT NULL DEFAULT '',
  snapshot TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_forecast_submissions_org_period ON forecast_submissions(org_id, period, created_at);

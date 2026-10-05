-- Additive; safe to rerun on SQLite and Cloudflare D1.
CREATE TABLE IF NOT EXISTS crm_property_writes (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL, connection_id TEXT NOT NULL, call_id TEXT, target_id TEXT NOT NULL,
  event TEXT NOT NULL, payload_hash TEXT NOT NULL, properties TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'queued',
  external_id TEXT, attempt INTEGER NOT NULL DEFAULT 0, last_error TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_crm_property_writes_connection ON crm_property_writes(org_id, connection_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_property_writes_payload ON crm_property_writes(org_id, connection_id, target_id, payload_hash);

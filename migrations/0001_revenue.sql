-- Additive revenue tables. Initialize schema.sql and tenant columns first.
-- Matches src/lib/db/revenueMigrations.ts.

CREATE TABLE IF NOT EXISTS integration_connections (
    id TEXT PRIMARY KEY, org_id TEXT NOT NULL, provider TEXT NOT NULL,
    name TEXT NOT NULL, credentials TEXT NOT NULL, config TEXT NOT NULL DEFAULT '{}',
    cursor TEXT NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'connected',
    last_synced_at TEXT, last_error TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );

CREATE INDEX IF NOT EXISTS idx_integrations_org ON integration_connections(org_id, provider);

CREATE TABLE IF NOT EXISTS crm_records (
    id TEXT PRIMARY KEY, org_id TEXT NOT NULL, connection_id TEXT NOT NULL,
    provider TEXT NOT NULL, external_id TEXT NOT NULL, kind TEXT NOT NULL,
    name TEXT NOT NULL, email TEXT, domain TEXT, stage TEXT, pipeline TEXT,
    amount TEXT, currency TEXT, owner TEXT, close_date TEXT, closed INTEGER NOT NULL DEFAULT 0,
    associations TEXT NOT NULL DEFAULT '[]', properties TEXT NOT NULL DEFAULT '{}',
    source_url TEXT, synced_at TEXT NOT NULL
  );

CREATE INDEX IF NOT EXISTS idx_crm_org_kind ON crm_records(org_id, kind);

CREATE TABLE IF NOT EXISTS call_metadata (
    call_id TEXT PRIMARY KEY, org_id TEXT NOT NULL, title TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'upload', external_id TEXT, connection_id TEXT,
    recording_page_url TEXT, participants TEXT NOT NULL DEFAULT '[]',
    summary TEXT NOT NULL DEFAULT '', action_items TEXT NOT NULL DEFAULT '[]',
    segments TEXT NOT NULL DEFAULT '[]', crm_record_ids TEXT NOT NULL DEFAULT '[]', crm_matches TEXT NOT NULL DEFAULT '[]',
    reviewed_at TEXT, reviewed_by TEXT, created_at TEXT NOT NULL
  );

CREATE INDEX IF NOT EXISTS idx_call_metadata_org ON call_metadata(org_id, source);

CREATE TABLE IF NOT EXISTS conversation_comments (
    id TEXT PRIMARY KEY, org_id TEXT NOT NULL, call_id TEXT NOT NULL,
    author_id TEXT NOT NULL, author_name TEXT NOT NULL, body TEXT NOT NULL,
    timestamp_seconds INTEGER, created_at TEXT NOT NULL
  );

CREATE INDEX IF NOT EXISTS idx_comments_call ON conversation_comments(org_id, call_id);

CREATE TABLE IF NOT EXISTS conversation_clips (
    id TEXT PRIMARY KEY, org_id TEXT NOT NULL, call_id TEXT NOT NULL, title TEXT NOT NULL,
    collection TEXT NOT NULL DEFAULT 'Examples', start_seconds INTEGER NOT NULL,
    end_seconds INTEGER NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL
  );

CREATE INDEX IF NOT EXISTS idx_clips_org ON conversation_clips(org_id, collection);

CREATE TABLE IF NOT EXISTS score_overrides (
    id TEXT PRIMARY KEY, org_id TEXT NOT NULL, call_id TEXT NOT NULL, metric_key TEXT NOT NULL,
    score INTEGER NOT NULL, reason TEXT NOT NULL, author_name TEXT NOT NULL, updated_at TEXT NOT NULL
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_override_metric ON score_overrides(org_id, call_id, metric_key);

CREATE TABLE IF NOT EXISTS conversation_trackers (
    id TEXT PRIMARY KEY, org_id TEXT NOT NULL, name TEXT NOT NULL, keywords TEXT NOT NULL,
    speaker TEXT NOT NULL DEFAULT 'any', created_at TEXT NOT NULL
  );

CREATE INDEX IF NOT EXISTS idx_trackers_org ON conversation_trackers(org_id);

CREATE TABLE IF NOT EXISTS saved_searches (
    id TEXT PRIMARY KEY, org_id TEXT NOT NULL, user_id TEXT NOT NULL,
    name TEXT NOT NULL, filters TEXT NOT NULL, created_at TEXT NOT NULL
  );

CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON saved_searches(org_id, user_id);

CREATE TABLE IF NOT EXISTS processing_jobs (
    id TEXT PRIMARY KEY, org_id TEXT NOT NULL, kind TEXT NOT NULL, connection_id TEXT,
    call_id TEXT, payload TEXT NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'queued',
    attempts INTEGER NOT NULL DEFAULT 0, available_at TEXT NOT NULL,
    lease_token TEXT, lease_until TEXT, result TEXT, last_error TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );

CREATE INDEX IF NOT EXISTS idx_jobs_ready ON processing_jobs(status, available_at);

CREATE INDEX IF NOT EXISTS idx_jobs_org ON processing_jobs(org_id, created_at);

CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY, org_id TEXT NOT NULL, actor TEXT NOT NULL,
    action TEXT NOT NULL, entity_id TEXT NOT NULL, created_at TEXT NOT NULL
  );

CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_events(org_id, created_at);

CREATE TABLE IF NOT EXISTS deleted_imports (
    id TEXT PRIMARY KEY, org_id TEXT NOT NULL, deleted_at TEXT NOT NULL
  );

CREATE INDEX IF NOT EXISTS idx_calls_org_date ON calls(org_id, created_at);

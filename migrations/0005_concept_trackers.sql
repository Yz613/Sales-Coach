-- Additive concept trackers and alert streams. Safe to rerun on SQLite and D1.
CREATE TABLE IF NOT EXISTS ai_trackers (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL, name TEXT NOT NULL, concept TEXT NOT NULL,
  speaker TEXT NOT NULL DEFAULT 'any', enabled INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_trackers_org ON ai_trackers(org_id);
CREATE TABLE IF NOT EXISTS ai_tracker_hits (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL, tracker_id TEXT NOT NULL, call_id TEXT NOT NULL,
  start_seconds INTEGER NOT NULL, speaker TEXT NOT NULL, quote TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_tracker_hits_call ON ai_tracker_hits(org_id, call_id);
CREATE INDEX IF NOT EXISTS idx_ai_tracker_hits_tracker ON ai_tracker_hits(org_id, tracker_id);
CREATE TABLE IF NOT EXISTS alert_streams (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL, name TEXT NOT NULL, filter TEXT NOT NULL,
  notify_slack INTEGER NOT NULL DEFAULT 0, notify_discord INTEGER NOT NULL DEFAULT 0,
  notify_in_app INTEGER NOT NULL DEFAULT 1, enabled INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_alert_streams_org ON alert_streams(org_id);
CREATE TABLE IF NOT EXISTS stream_notifications (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL, stream_id TEXT NOT NULL, call_id TEXT NOT NULL,
  title TEXT NOT NULL, body TEXT NOT NULL, start_seconds INTEGER, read_at TEXT, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_stream_notifications_org ON stream_notifications(org_id, created_at);

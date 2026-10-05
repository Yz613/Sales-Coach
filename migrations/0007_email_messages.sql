-- Mailbox activity. Metadata and a short snippet only; message bodies are not stored.
CREATE TABLE IF NOT EXISTS email_messages (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  connection_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  thread_id TEXT NOT NULL DEFAULT '',
  owner_user_id TEXT NOT NULL DEFAULT '',
  direction TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  snippet TEXT NOT NULL DEFAULT '',
  participants TEXT NOT NULL DEFAULT '[]',
  sent_at TEXT NOT NULL,
  deal_ids TEXT NOT NULL DEFAULT '[]',
  account_ids TEXT NOT NULL DEFAULT '[]',
  synced_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_messages_source ON email_messages(org_id, connection_id, external_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_org_sent ON email_messages(org_id, sent_at);

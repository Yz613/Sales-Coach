CREATE TABLE IF NOT EXISTS security_rate_limits (id TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_security_rate_expiry ON security_rate_limits(expires_at);
CREATE TABLE IF NOT EXISTS checkout_claims (session_id TEXT PRIMARY KEY, org_id TEXT NOT NULL);

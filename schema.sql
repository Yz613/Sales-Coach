CREATE TABLE IF NOT EXISTS reps (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL DEFAULT 'local',
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  avatar_url TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS calls (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL DEFAULT 'local',
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
  org_id TEXT NOT NULL DEFAULT 'local',
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
  extended_review TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (call_id) REFERENCES calls(id),
  FOREIGN KEY (rep_id) REFERENCES reps(id)
);

CREATE TABLE IF NOT EXISTS rep_snapshots (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL DEFAULT 'local',
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
  org_id TEXT NOT NULL DEFAULT 'local',
  stage TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  key_milestones TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rep_personas (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL DEFAULT 'local',
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

CREATE INDEX IF NOT EXISTS idx_reps_org_id ON reps(org_id);
CREATE INDEX IF NOT EXISTS idx_calls_org_id ON calls(org_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_org_id ON evaluations(org_id);
CREATE INDEX IF NOT EXISTS idx_rep_snapshots_org_id ON rep_snapshots(org_id);
CREATE INDEX IF NOT EXISTS idx_scripts_org_id ON scripts(org_id);
CREATE INDEX IF NOT EXISTS idx_rep_personas_org_id ON rep_personas(org_id);
CREATE INDEX IF NOT EXISTS idx_calls_org_created ON calls(org_id, created_at);
CREATE INDEX IF NOT EXISTS idx_evaluations_org_call ON evaluations(org_id, call_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_org_rep ON evaluations(org_id, rep_id);
CREATE INDEX IF NOT EXISTS idx_rep_snapshots_org_rep ON rep_snapshots(org_id, rep_id);
CREATE INDEX IF NOT EXISTS idx_rep_personas_org_rep ON rep_personas(org_id, rep_id);


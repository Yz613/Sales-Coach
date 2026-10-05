-- Structured scorecards. Additive; existing evaluations and score corrections stay in place.
CREATE TABLE IF NOT EXISTS scorecard_templates (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  visibility TEXT NOT NULL DEFAULT 'managers',
  auto_apply INTEGER NOT NULL DEFAULT 0,
  filters TEXT NOT NULL DEFAULT '{}',
  archived INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_scorecard_templates_org ON scorecard_templates(org_id, archived);

CREATE TABLE IF NOT EXISTS scorecard_questions (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  prompt TEXT NOT NULL,
  guidance TEXT NOT NULL DEFAULT '',
  scale TEXT NOT NULL,
  weight REAL,
  rubric_key TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_scorecard_questions_template ON scorecard_questions(org_id, template_id, position);

CREATE TABLE IF NOT EXISTS scorecard_applications (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  call_id TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  overall_score REAL,
  answered_count INTEGER NOT NULL DEFAULT 0,
  question_count INTEGER NOT NULL DEFAULT 0,
  applied_by TEXT NOT NULL,
  applied_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_scorecard_app_unique ON scorecard_applications(org_id, template_id, call_id);
CREATE INDEX IF NOT EXISTS idx_scorecard_app_call ON scorecard_applications(org_id, call_id);

CREATE TABLE IF NOT EXISTS scorecard_answers (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  application_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  value TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  origin TEXT NOT NULL DEFAULT 'manual',
  author_name TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_scorecard_answer_unique ON scorecard_answers(org_id, application_id, question_id);

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const reps = sqliteTable("reps", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull(), // e.g. "Senior SDR", "Account Executive", "Outbound SDR"
  avatarUrl: text("avatar_url"),
  createdAt: text("created_at").notNull(),
});

export const calls = sqliteTable("calls", {
  id: text("id").primaryKey(),
  repId: text("rep_id").notNull().references(() => reps.id),
  prospectCompany: text("prospect_company").notNull(),
  prospectName: text("prospect_name").notNull(),
  callStage: text("call_stage").notNull(), // 'Cold Call' | 'First Discovery' | 'Follow-up'
  coreOutcome: text("core_outcome").notNull(),
  durationSeconds: integer("duration_seconds").notNull(),
  transcriptText: text("transcript_text").notNull(),
  audioUrl: text("audio_url"),
  status: text("status").notNull().default("completed"), // 'completed' | 'analyzing' | 'failed'
  createdAt: text("created_at").notNull(),
});

export const evaluations = sqliteTable("evaluations", {
  id: text("id").primaryKey(),
  callId: text("call_id").notNull().references(() => calls.id),
  repId: text("rep_id").notNull().references(() => reps.id),
  bottomLine: text("bottom_line").notNull(),
  painStatus: text("pain_status").notNull(), // 'Pass' | 'Incomplete' | 'Fail'
  painEvidence: text("pain_evidence").notNull(),
  budgetStatus: text("budget_status").notNull(), // 'Pass' | 'Incomplete' | 'Fail'
  budgetEvidence: text("budget_evidence").notNull(),
  decisionStatus: text("decision_status").notNull(), // 'Pass' | 'Incomplete' | 'Fail'
  decisionEvidence: text("decision_evidence").notNull(),
  scriptAdherenceScore: integer("script_adherence_score").notNull(), // 1 to 10
  scriptFeedback: text("script_feedback").notNull(),
  scriptDivergence: text("script_divergence"), // JSON string: ScriptDivergence (per-milestone Hit/Partial/Missed)
  missedOpportunities: text("missed_opportunities").notNull(), // JSON string: MissedOpportunity[]
  topFixes: text("top_fixes").notNull(), // JSON string: [PriorityFix, PriorityFix]
  rawMarkdown: text("raw_markdown"),
  createdAt: text("created_at").notNull(),
});

export const repSnapshots = sqliteTable("rep_snapshots", {
  id: text("id").primaryKey(),
  repId: text("rep_id").notNull().references(() => reps.id),
  overallTrajectory: text("overall_trajectory").notNull(), // 'progressing' | 'stagnant' | 'regressing'
  managerRationale: text("manager_rationale").notNull(),
  topActiveStruggle: text("top_active_struggle").notNull(),
  recentScriptScore: integer("recent_script_score").notNull(),
  lastUpdated: text("last_updated").notNull(),
});

export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const scripts = sqliteTable("scripts", {
  id: text("id").primaryKey(),
  stage: text("stage").notNull(), // 'Cold Call' | 'First Discovery' | 'Follow-up'
  title: text("title").notNull(),
  content: text("content").notNull(),
  keyMilestones: text("key_milestones").notNull(), // JSON array of string requirements
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  updatedAt: text("updated_at").notNull(),
});

export const repPersonas = sqliteTable("rep_personas", {
  id: text("id").primaryKey(),
  repId: text("rep_id").notNull().references(() => reps.id),
  experienceLevel: text("experience_level").notNull(), // 'Rookie SDR' | 'Ramping AE' | 'Senior AE'
  coachingTone: text("coaching_tone").notNull(), // 'Tough Love / Direct VP' | 'Analytical & Tactical' | 'Structured & Step-by-Step'
  knownBlindspots: text("known_blindspots").notNull(), // JSON array of string tags
  strengths: text("strengths").notNull(), // JSON array or description
  managerNotes: text("manager_notes").notNull(), // Private manager notes for AI coach
  targetQuota: text("target_quota"),
  updatedAt: text("updated_at").notNull(),
});

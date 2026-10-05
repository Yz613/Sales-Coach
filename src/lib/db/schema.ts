import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const reps = sqliteTable("reps", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().default("local"),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull(), // e.g. "Senior SDR", "Account Executive", "Outbound SDR"
  avatarUrl: text("avatar_url"),
  createdAt: text("created_at").notNull(),
});

export const calls = sqliteTable("calls", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().default("local"),
  repId: text("rep_id").notNull().references(() => reps.id),
  prospectCompany: text("prospect_company").notNull(),
  prospectName: text("prospect_name").notNull(),
  callStage: text("call_stage").notNull(), // Call Stage Target (built-in or custom)
  coreOutcome: text("core_outcome").notNull(),
  durationSeconds: integer("duration_seconds").notNull(),
  transcriptText: text("transcript_text").notNull(),
  audioUrl: text("audio_url"),
  status: text("status").notNull().default("completed"), // 'completed' | 'analyzing' | 'failed'
  createdAt: text("created_at").notNull(),
});

export const evaluations = sqliteTable("evaluations", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().default("local"),
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
  extendedReview: text("extended_review"), // JSON: scorecard + walkthrough + evaluatedWith
  createdAt: text("created_at").notNull(),
});

export const repSnapshots = sqliteTable("rep_snapshots", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().default("local"),
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
  orgId: text("org_id").notNull().default("local"),
  stage: text("stage").notNull(), // Call Stage Target (built-in or custom)
  title: text("title").notNull(),
  content: text("content").notNull(),
  keyMilestones: text("key_milestones").notNull(), // JSON array of string requirements
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  updatedAt: text("updated_at").notNull(),
});

export const repPersonas = sqliteTable("rep_personas", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().default("local"),
  repId: text("rep_id").notNull().references(() => reps.id),
  experienceLevel: text("experience_level").notNull(), // 'Rookie SDR' | 'Ramping AE' | 'Senior AE'
  coachingTone: text("coaching_tone").notNull(), // 'Tough Love / Direct VP' | 'Analytical & Tactical' | 'Structured & Step-by-Step'
  knownBlindspots: text("known_blindspots").notNull(), // JSON array of string tags
  strengths: text("strengths").notNull(), // JSON array or description
  managerNotes: text("manager_notes").notNull(), // Private manager notes for AI coach
  targetQuota: text("target_quota"),
  updatedAt: text("updated_at").notNull(),
});

export const integrationConnections = sqliteTable("integration_connections", {
  id: text("id").primaryKey(), orgId: text("org_id").notNull(), provider: text("provider").notNull(),
  name: text("name").notNull(), credentials: text("credentials").notNull(),
  config: text("config").notNull().default("{}"), cursor: text("cursor").notNull().default("{}"),
  status: text("status").notNull().default("connected"), lastSyncedAt: text("last_synced_at"),
  lastError: text("last_error"), createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
});

export const crmRecords = sqliteTable("crm_records", {
  id: text("id").primaryKey(), orgId: text("org_id").notNull(), connectionId: text("connection_id").notNull(),
  provider: text("provider").notNull(), externalId: text("external_id").notNull(), kind: text("kind").notNull(),
  name: text("name").notNull(), email: text("email"), domain: text("domain"), stage: text("stage"),
  pipeline: text("pipeline"), amount: text("amount"), currency: text("currency"), owner: text("owner"),
  closeDate: text("close_date"), closed: integer("closed", { mode: "boolean" }).notNull().default(false),
  associations: text("associations").notNull().default("[]"), properties: text("properties").notNull().default("{}"),
  sourceUrl: text("source_url"), syncedAt: text("synced_at").notNull(),
});

export const dealReviews = sqliteTable("deal_reviews", {
  id: text("id").primaryKey(), orgId: text("org_id").notNull(), dealId: text("deal_id").notNull(),
  category: text("category").notNull(), probability: integer("probability"),
  nextStep: text("next_step").notNull().default(""), nextStepDate: text("next_step_date"),
  playbook: text("playbook").notNull().default("{}"), revision: integer("revision").notNull(),
  updatedBy: text("updated_by").notNull(), updatedAt: text("updated_at").notNull(),
});

export const forecastSubmissions = sqliteTable("forecast_submissions", {
  id: text("id").primaryKey(), orgId: text("org_id").notNull(), period: text("period").notNull(),
  owner: text("owner").notNull().default(""), currency: text("currency").notNull().default(""),
  target: text("target"), notes: text("notes").notNull().default(""), snapshot: text("snapshot").notNull(),
  createdBy: text("created_by").notNull(), createdAt: text("created_at").notNull(),
});

export const callMetadata = sqliteTable("call_metadata", {
  callId: text("call_id").primaryKey(), orgId: text("org_id").notNull(), title: text("title").notNull(),
  source: text("source").notNull().default("upload"), externalId: text("external_id"), connectionId: text("connection_id"),
  recordingPageUrl: text("recording_page_url"), participants: text("participants").notNull().default("[]"),
  summary: text("summary").notNull().default(""), actionItems: text("action_items").notNull().default("[]"),
  segments: text("segments").notNull().default("[]"), crmRecordIds: text("crm_record_ids").notNull().default("[]"),
  crmMatches: text("crm_matches").notNull().default("[]"),
  reviewedAt: text("reviewed_at"), reviewedBy: text("reviewed_by"), createdAt: text("created_at").notNull(),
});

export const callProviderInsights = sqliteTable("call_provider_insights", {
  callId: text("call_id").primaryKey(), orgId: text("org_id").notNull(), data: text("data").notNull(),
});

export const integrationExports = sqliteTable("integration_exports", {
  id: text("id").primaryKey(), orgId: text("org_id").notNull(), connectionId: text("connection_id").notNull(), callId: text("call_id").notNull(),
  event: text("event").notNull(), targetId: text("target_id"), status: text("status").notNull().default("queued"),
  externalId: text("external_id"), attempt: integer("attempt").notNull().default(0), lastError: text("last_error"),
  createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
});

export const conversationComments = sqliteTable("conversation_comments", {
  id: text("id").primaryKey(), orgId: text("org_id").notNull(), callId: text("call_id").notNull(),
  authorId: text("author_id").notNull(), authorName: text("author_name").notNull(), body: text("body").notNull(),
  timestampSeconds: integer("timestamp_seconds"), createdAt: text("created_at").notNull(),
});

export const conversationClips = sqliteTable("conversation_clips", {
  id: text("id").primaryKey(), orgId: text("org_id").notNull(), callId: text("call_id").notNull(),
  title: text("title").notNull(), collection: text("collection").notNull().default("Examples"),
  startSeconds: integer("start_seconds").notNull(), endSeconds: integer("end_seconds").notNull(),
  createdBy: text("created_by").notNull(), createdAt: text("created_at").notNull(),
});

export const scoreOverrides = sqliteTable("score_overrides", {
  id: text("id").primaryKey(), orgId: text("org_id").notNull(), callId: text("call_id").notNull(),
  metricKey: text("metric_key").notNull(), score: integer("score").notNull(), reason: text("reason").notNull(),
  authorName: text("author_name").notNull(), updatedAt: text("updated_at").notNull(),
  originalScore: integer("original_score"),
  originalProbabilities: text("original_probabilities"),
  clefModel: text("clef_model"),
  rubricVersion: text("rubric_version"),
  metadata: text("metadata"),
});

export const conversationTrackers = sqliteTable("conversation_trackers", {
  id: text("id").primaryKey(), orgId: text("org_id").notNull(), name: text("name").notNull(),
  keywords: text("keywords").notNull(), speaker: text("speaker").notNull().default("any"), createdAt: text("created_at").notNull(),
});

export const savedSearches = sqliteTable("saved_searches", {
  id: text("id").primaryKey(), orgId: text("org_id").notNull(), userId: text("user_id").notNull(),
  name: text("name").notNull(), filters: text("filters").notNull(), createdAt: text("created_at").notNull(),
});

export const processingJobs = sqliteTable("processing_jobs", {
  id: text("id").primaryKey(), orgId: text("org_id").notNull(), kind: text("kind").notNull(),
  connectionId: text("connection_id"), callId: text("call_id"), payload: text("payload").notNull().default("{}"),
  status: text("status").notNull().default("queued"), attempts: integer("attempts").notNull().default(0),
  availableAt: text("available_at").notNull(), leaseToken: text("lease_token"), leaseUntil: text("lease_until"),
  result: text("result"), lastError: text("last_error"), createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
});

export const auditEvents = sqliteTable("audit_events", {
  id: text("id").primaryKey(), orgId: text("org_id").notNull(), actor: text("actor").notNull(),
  action: text("action").notNull(), entityId: text("entity_id").notNull(), createdAt: text("created_at").notNull(),
});

export const deletedImports = sqliteTable("deleted_imports", {
  id: text("id").primaryKey(), orgId: text("org_id").notNull(), deletedAt: text("deleted_at").notNull(),
});

export const securityRateLimits = sqliteTable("security_rate_limits", {
  id: text("id").primaryKey(), count: integer("count").notNull(), expiresAt: integer("expires_at").notNull(),
});

export const checkoutClaims = sqliteTable("checkout_claims", {
  sessionId: text("session_id").primaryKey(), orgId: text("org_id").notNull(),
});

export const scheduledMeetings = sqliteTable("scheduled_meetings", {
  id: text("id").primaryKey(), orgId: text("org_id").notNull(), connectionId: text("connection_id").notNull(),
  provider: text("provider").notNull(), externalId: text("external_id").notNull(), title: text("title").notNull(),
  startAt: text("start_at").notNull(), endAt: text("end_at").notNull(), status: text("status").notNull(),
  organizerEmail: text("organizer_email").notNull().default(""), participants: text("participants").notNull().default("[]"),
  location: text("location").notNull().default(""), sourceUrl: text("source_url"), syncedAt: text("synced_at").notNull(),
});

export const integrationOAuthStates = sqliteTable("integration_oauth_states", {
  id: text("id").primaryKey(), orgId: text("org_id").notNull(), actor: text("actor").notNull(),
  provider: text("provider").notNull(), credentials: text("credentials").notNull(), expiresAt: integer("expires_at").notNull(),
});

export const integrationOAuthRefreshLeases = sqliteTable("integration_oauth_refresh_leases", {
  id: text("id").primaryKey(), orgId: text("org_id").notNull(), connectionId: text("connection_id").notNull(),
  token: text("token").notNull(), expiresAt: integer("expires_at").notNull(),
});

export const externalTasks = sqliteTable("external_tasks", {
  id: text("id").primaryKey(), orgId: text("org_id").notNull(), connectionId: text("connection_id").notNull(), provider: text("provider").notNull(),
  externalId: text("external_id").notNull(), title: text("title").notNull(), description: text("description").notNull().default(""), status: text("status").notNull(),
  assignee: text("assignee").notNull().default(""), dueAt: text("due_at"), sourceUrl: text("source_url"), callId: text("call_id"), syncedAt: text("synced_at").notNull(),
});
export const taskExports = sqliteTable("task_exports", {
  id: text("id").primaryKey(), orgId: text("org_id").notNull(), connectionId: text("connection_id").notNull(), callId: text("call_id").notNull(),
  actionId: text("action_id").notNull(), title: text("title").notNull(), status: text("status").notNull().default("queued"), externalId: text("external_id"), sourceUrl: text("source_url"),
  attempt: integer("attempt").notNull().default(0), lastError: text("last_error"), createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
});

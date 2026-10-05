import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db, ensureRevenueSchema } from "./db";
import {
  calls,
  callMetadata,
  evaluations,
  scoreOverrides,
  scorecardAnswers,
  scorecardApplications,
  scorecardQuestions,
  scorecardTemplates,
} from "./db/schema";
import { getCallStages, getSetting, listRepIdentities } from "./db/service";
import { currentTenantId } from "./tenant";
import { GOAL_TEAMS_SETTING_KEY, readGoalTeams, type GoalTeam } from "./goalTeams";
import { isOwnRep } from "./call-access";
import { toCallViewer } from "./viewer-calls";
import { parseExtendedReview } from "./ai/review";
import type { AuthUser } from "./auth";
import { accessibleCall } from "./revenue/access";
import { RevenueError, stableId, textInput } from "./revenue/security";
import {
  answerFitsScale,
  answerFromRubric,
  callMatchesFilters,
  canViewScorecard,
  coachingScoreFromAnswer,
  isScoreScale,
  isScoreVisibility,
  parseFilters,
  weightedOverall,
  type RubricSignal,
  type ScorecardFilters,
  type ScoreScale,
  type ScoreVisibility,
} from "./scorecardModel";

const scoped = (table: { orgId: any }) => eq(table.orgId, currentTenantId());
const nowIso = () => new Date().toISOString();
const actorName = (auth: AuthUser) => auth.name || auth.email || "Local admin";

type TemplateRow = typeof scorecardTemplates.$inferSelect;
type QuestionRow = typeof scorecardQuestions.$inferSelect;
type ApplicationRow = typeof scorecardApplications.$inferSelect;

export interface ScorecardQuestionInput {
  id?: string;
  prompt: string;
  guidance?: string;
  scale: ScoreScale;
  weight?: number | null;
  rubricKey?: string | null;
}

export interface ScorecardDraft {
  name: string;
  description?: string;
  visibility: ScoreVisibility;
  autoApply: boolean;
  filters?: unknown;
  questions: ScorecardQuestionInput[];
}

function parseWeight(value: unknown): number | null {
  if (value == null || value === "") return null;
  const weight = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(weight) || weight <= 0 || weight > 100) {
    throw new RevenueError("Weight must be greater than 0 and at most 100, or left blank.");
  }
  return Math.round(weight * 100) / 100;
}

function parseRubricKey(value: unknown): string | null {
  if (value == null || value === "") return null;
  const key = textInput(value, "Coaching metric", 80, false);
  if (!key) return null;
  if (!/^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(key)) {
    throw new RevenueError("Coaching metric keys use letters, numbers, _ or -.");
  }
  return key;
}

function parseDraft(body: any): ScorecardDraft {
  if (!body || typeof body !== "object") throw new RevenueError("Send a scorecard.");
  const visibility = body.visibility;
  if (!isScoreVisibility(visibility)) throw new RevenueError("Choose who can see these scores.");
  const questions = Array.isArray(body.questions) ? body.questions : null;
  if (!questions || questions.length < 1 || questions.length > 30) {
    throw new RevenueError("Add between 1 and 30 questions.");
  }
  return {
    name: textInput(body.name, "Scorecard name", 120),
    description: textInput(body.description || "", "Description", 2000, false),
    visibility,
    autoApply: Boolean(body.autoApply),
    filters: parseFilters(body.filters),
    questions: questions.map((question: any) => {
      if (!isScoreScale(question?.scale)) throw new RevenueError("Each question is pass/fail or a 1–5 rating.");
      return {
        id: typeof question.id === "string" ? question.id : undefined,
        prompt: textInput(question.prompt, "Question", 500),
        guidance: textInput(question.guidance || "", "Guidance", 1000, false),
        scale: question.scale,
        weight: parseWeight(question.weight),
        rubricKey: parseRubricKey(question.rubricKey),
      };
    }),
  };
}

async function loadGoalTeams(): Promise<GoalTeam[]> {
  return readGoalTeams(await getSetting(GOAL_TEAMS_SETTING_KEY), await listRepIdentities());
}

function presentQuestion(question: QuestionRow) {
  return {
    id: question.id,
    position: question.position,
    prompt: question.prompt,
    guidance: question.guidance,
    scale: question.scale as ScoreScale,
    weight: question.weight ?? null,
    rubricKey: question.rubricKey || null,
  };
}

function presentTemplate(row: TemplateRow, questions: QuestionRow[], applicationCount = 0) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    visibility: row.visibility as ScoreVisibility,
    autoApply: Boolean(row.autoApply),
    filters: parseFilters(row.filters),
    archived: Boolean(row.archived),
    applicationCount,
    questions: questions.map(presentQuestion),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function questionsFor(templateId: string): Promise<QuestionRow[]> {
  return db.select().from(scorecardQuestions)
    .where(and(scoped(scorecardQuestions), eq(scorecardQuestions.templateId, templateId)))
    .orderBy(asc(scorecardQuestions.position)).all();
}

async function templateById(id: string): Promise<TemplateRow | undefined> {
  return db.select().from(scorecardTemplates).where(and(scoped(scorecardTemplates), eq(scorecardTemplates.id, id))).get();
}

export async function scorecardEditorOptions() {
  const teams = await loadGoalTeams();
  return {
    teams: teams.map((team) => ({ id: team.id, name: team.name })),
    stages: await getCallStages(),
  };
}

export async function listScorecards() {
  await ensureRevenueSchema();
  const templates = await db.select().from(scorecardTemplates).where(scoped(scorecardTemplates)).orderBy(desc(scorecardTemplates.updatedAt)).all();
  const questions = await db.select().from(scorecardQuestions).where(scoped(scorecardQuestions)).orderBy(asc(scorecardQuestions.position)).all();
  const counts = await db.select({
    templateId: scorecardApplications.templateId,
    count: sql<number>`count(*)`,
  }).from(scorecardApplications).where(scoped(scorecardApplications)).groupBy(scorecardApplications.templateId).all();
  const byTemplate = new Map<string, QuestionRow[]>();
  for (const question of questions) {
    const list = byTemplate.get(question.templateId) || [];
    list.push(question);
    byTemplate.set(question.templateId, list);
  }
  const countByTemplate = new Map<string, number>();
  for (const row of counts as { templateId: string; count: number }[]) countByTemplate.set(row.templateId, Number(row.count) || 0);
  return {
    templates: templates.map((row: TemplateRow) => presentTemplate(row, byTemplate.get(row.id) || [], countByTemplate.get(row.id) || 0)),
    options: await scorecardEditorOptions(),
  };
}

async function recompute(applicationId: string) {
  const orgId = currentTenantId();
  const application = await db.select().from(scorecardApplications)
    .where(and(eq(scorecardApplications.orgId, orgId), eq(scorecardApplications.id, applicationId))).get();
  if (!application) return;
  const questions = await questionsFor(application.templateId);
  const answers = await db.select().from(scorecardAnswers)
    .where(and(eq(scorecardAnswers.orgId, orgId), eq(scorecardAnswers.applicationId, applicationId))).all();
  const items = questions.map((question: QuestionRow) => {
    const answer = answers.find((row: { questionId: string; value: string }) => row.questionId === question.id);
    const value = answer && answerFitsScale(question.scale as ScoreScale, answer.value) ? answer.value : null;
    return { scale: question.scale as ScoreScale, value, weight: question.weight ?? null };
  });
  const answeredCount = items.filter((item) => item.value).length;
  const complete = questions.length > 0 && answeredCount === questions.length;
  await db.update(scorecardApplications).set({
    overallScore: weightedOverall(items),
    answeredCount,
    questionCount: questions.length,
    status: complete && application.status === "submitted" ? "submitted" : "open",
    updatedAt: nowIso(),
  }).where(and(eq(scorecardApplications.orgId, orgId), eq(scorecardApplications.id, applicationId))).run();
}

async function signalsForCall(callId: string): Promise<Map<string, RubricSignal>> {
  const orgId = currentTenantId();
  const evaluation = await db.select().from(evaluations)
    .where(and(eq(evaluations.orgId, orgId), eq(evaluations.callId, callId)))
    .orderBy(desc(evaluations.createdAt)).get();
  const overrides = await db.select().from(scoreOverrides)
    .where(and(eq(scoreOverrides.orgId, orgId), eq(scoreOverrides.callId, callId))).all();
  const signals = new Map<string, RubricSignal>();
  if (evaluation) {
    signals.set("pain", { score: null, status: evaluation.painStatus });
    signals.set("budget", { score: null, status: evaluation.budgetStatus });
    signals.set("decision", { score: null, status: evaluation.decisionStatus });
    signals.set("scriptAdherence", { score: evaluation.scriptAdherenceScore, status: null });
    for (const metric of parseExtendedReview(evaluation.extendedReview)?.scorecard || []) {
      if (!metric?.key) continue;
      signals.set(String(metric.key), {
        score: Number.isFinite(metric.score) ? metric.score : null,
        status: metric.status || null,
      });
    }
  }
  for (const override of overrides) {
    const current = signals.get(override.metricKey) || { score: null, status: null };
    signals.set(override.metricKey, { ...current, score: override.score });
  }
  return signals;
}

async function upsertAnswer(applicationId: string, questionId: string, value: string, note: string, origin: string, author: string) {
  const orgId = currentTenantId();
  const id = stableId(orgId, "scorecard-answer", applicationId, questionId);
  const row = {
    id, orgId, applicationId, questionId, value, note, origin, authorName: author, updatedAt: nowIso(),
  };
  await db.insert(scorecardAnswers).values(row).onConflictDoUpdate({
    target: scorecardAnswers.id,
    set: { value, note, origin, authorName: author, updatedAt: row.updatedAt },
  }).run();
}

/** Fill linked questions from the coaching rubric. Manual and correction answers stay put. */
async function seedApplicationFromRubric(applicationId: string) {
  const orgId = currentTenantId();
  const application = await db.select().from(scorecardApplications)
    .where(and(eq(scorecardApplications.orgId, orgId), eq(scorecardApplications.id, applicationId))).get();
  if (!application) return;
  const questions = await questionsFor(application.templateId);
  const answers = await db.select().from(scorecardAnswers)
    .where(and(eq(scorecardAnswers.orgId, orgId), eq(scorecardAnswers.applicationId, applicationId))).all();
  const signals = await signalsForCall(application.callId);
  for (const question of questions) {
    if (!question.rubricKey) continue;
    const value = answerFromRubric(question.scale as ScoreScale, signals.get(question.rubricKey));
    if (!value) continue;
    const existing = answers.find((answer: { questionId: string }) => answer.questionId === question.id);
    if (existing && existing.origin !== "rubric") continue;
    if (existing && existing.value === value) continue;
    await upsertAnswer(applicationId, question.id, value, existing?.note || "", "rubric", "Coaching rubric");
  }
  await recompute(applicationId);
}

async function ensureApplication(template: TemplateRow, callId: string, source: "manual" | "auto", actor: string) {
  const orgId = currentTenantId();
  const id = stableId(orgId, "scorecard-app", template.id, callId);
  const existing = await db.select({ id: scorecardApplications.id }).from(scorecardApplications)
    .where(and(eq(scorecardApplications.orgId, orgId), eq(scorecardApplications.id, id))).get();
  let created = false;
  if (!existing) {
    const questions = await questionsFor(template.id);
    const stamp = nowIso();
    await db.insert(scorecardApplications).values({
      id, orgId, templateId: template.id, callId, source, status: "open", overallScore: null,
      answeredCount: 0, questionCount: questions.length, appliedBy: actor, appliedAt: stamp, updatedAt: stamp,
    }).onConflictDoNothing().run();
    created = true;
  }
  await seedApplicationFromRubric(id);
  return { id, created };
}

async function writeLinkedOverride(callId: string, rubricKey: string, score: number, author: string, prompt: string, note: string) {
  const orgId = currentTenantId();
  const id = stableId(orgId, callId, rubricKey);
  const stamp = nowIso();
  const reason = (note ? `Structured scorecard (${prompt}): ${note}` : `Structured scorecard answer for “${prompt}”.`).slice(0, 2000);
  const existing = await db.select({ id: scoreOverrides.id }).from(scoreOverrides)
    .where(and(eq(scoreOverrides.orgId, orgId), eq(scoreOverrides.id, id))).get();
  if (existing) {
    await db.update(scoreOverrides).set({ score, reason, authorName: author, updatedAt: stamp })
      .where(and(eq(scoreOverrides.orgId, orgId), eq(scoreOverrides.id, id))).run();
    return;
  }
  const signal = (await signalsForCall(callId)).get(rubricKey);
  await db.insert(scoreOverrides).values({
    id, orgId, callId, metricKey: rubricKey, score, reason, authorName: author, updatedAt: stamp,
    originalScore: signal?.score ?? null, originalProbabilities: null, clefModel: null, rubricVersion: "1.0", metadata: null,
  }).run();
}

async function replaceQuestions(templateId: string, questions: ScorecardQuestionInput[]) {
  const orgId = currentTenantId();
  const existing = await questionsFor(templateId);
  const existingIds = new Set(existing.map((question: QuestionRow) => question.id));
  const kept = new Set<string>();
  const stamp = nowIso();
  for (let index = 0; index < questions.length; index++) {
    const question = questions[index];
    const id = question.id && existingIds.has(question.id) ? question.id : randomUUID();
    kept.add(id);
    const values = {
      id, orgId, templateId, position: index + 1, prompt: question.prompt, guidance: question.guidance || "",
      scale: question.scale, weight: question.weight ?? null, rubricKey: question.rubricKey ?? null, createdAt: stamp,
    };
    await db.insert(scorecardQuestions).values(values).onConflictDoUpdate({
      target: scorecardQuestions.id,
      set: {
        position: values.position, prompt: values.prompt, guidance: values.guidance, scale: values.scale,
        weight: values.weight, rubricKey: values.rubricKey,
      },
    }).run();
    if (question.scale) {
      const answers = await db.select().from(scorecardAnswers)
        .where(and(eq(scorecardAnswers.orgId, orgId), eq(scorecardAnswers.questionId, id))).all();
      for (const answer of answers) {
        if (!answerFitsScale(question.scale, answer.value)) {
          await db.delete(scorecardAnswers).where(and(eq(scorecardAnswers.orgId, orgId), eq(scorecardAnswers.id, answer.id))).run();
        }
      }
    }
  }
  const removed = existing.filter((question: QuestionRow) => !kept.has(question.id)).map((question: QuestionRow) => question.id);
  if (removed.length) {
    await db.delete(scorecardAnswers).where(and(eq(scorecardAnswers.orgId, orgId), inArray(scorecardAnswers.questionId, removed))).run();
    await db.delete(scorecardQuestions).where(and(eq(scorecardQuestions.orgId, orgId), inArray(scorecardQuestions.id, removed))).run();
  }
}

async function backfill(template: TemplateRow) {
  if (!template.autoApply || template.archived) return 0;
  const orgId = currentTenantId();
  const filters = parseFilters(template.filters);
  const rows = await db.select({ id: calls.id, repId: calls.repId, callStage: calls.callStage }).from(calls)
    .where(eq(calls.orgId, orgId)).orderBy(desc(calls.createdAt)).limit(500).all();
  const metadata = await db.select({ callId: callMetadata.callId, source: callMetadata.source }).from(callMetadata)
    .where(eq(callMetadata.orgId, orgId)).all();
  const sourceByCall = new Map<string, string>();
  for (const row of metadata as { callId: string; source: string | null }[]) sourceByCall.set(row.callId, row.source || "upload");
  const teams = await loadGoalTeams();
  let created = 0;
  for (const call of rows as { id: string; repId: string; callStage: string }[]) {
    const teamIds = teams.filter((team) => team.repIds.includes(call.repId)).map((team) => team.id);
    if (!callMatchesFilters(filters, { stage: call.callStage, source: sourceByCall.get(call.id) || "upload", teamIds })) continue;
    const result = await ensureApplication(template, call.id, "auto", "auto");
    if (result.created) created++;
  }
  return created;
}

export async function saveScorecard(actor: string, body: any, id?: string) {
  await ensureRevenueSchema();
  const draft = parseDraft(body);
  const orgId = currentTenantId();
  const stamp = nowIso();
  const filters = JSON.stringify(draft.filters as ScorecardFilters);
  let templateId = id;
  if (templateId) {
    const existing = await templateById(templateId);
    if (!existing) throw new RevenueError("Scorecard not found.", 404);
    await db.update(scorecardTemplates).set({
      name: draft.name, description: draft.description || "", visibility: draft.visibility,
      autoApply: draft.autoApply, filters, updatedAt: stamp,
    }).where(and(scoped(scorecardTemplates), eq(scorecardTemplates.id, templateId))).run();
  } else {
    templateId = randomUUID();
    await db.insert(scorecardTemplates).values({
      id: templateId, orgId, name: draft.name, description: draft.description || "", visibility: draft.visibility,
      autoApply: draft.autoApply, filters, archived: false, createdBy: actor, createdAt: stamp, updatedAt: stamp,
    }).run();
  }
  await replaceQuestions(templateId, draft.questions);
  const applications = await db.select({ id: scorecardApplications.id }).from(scorecardApplications)
    .where(and(scoped(scorecardApplications), eq(scorecardApplications.templateId, templateId))).all();
  for (const application of applications) await seedApplicationFromRubric(application.id);
  const saved = await templateById(templateId);
  if (!saved) throw new RevenueError("Scorecard not found.", 404);
  const applied = await backfill(saved);
  const questions = await questionsFor(templateId);
  return { template: presentTemplate(saved, questions), applied };
}

export async function removeScorecard(id: string) {
  await ensureRevenueSchema();
  const existing = await templateById(id);
  if (!existing) throw new RevenueError("Scorecard not found.", 404);
  const applications = await db.select({ id: scorecardApplications.id }).from(scorecardApplications)
    .where(and(scoped(scorecardApplications), eq(scorecardApplications.templateId, id))).all();
  if (applications.length) {
    await db.update(scorecardTemplates).set({ archived: true, autoApply: false, updatedAt: nowIso() })
      .where(and(scoped(scorecardTemplates), eq(scorecardTemplates.id, id))).run();
    return { archived: true, deleted: false };
  }
  await db.delete(scorecardQuestions).where(and(scoped(scorecardQuestions), eq(scorecardQuestions.templateId, id))).run();
  await db.delete(scorecardTemplates).where(and(scoped(scorecardTemplates), eq(scorecardTemplates.id, id))).run();
  return { archived: false, deleted: true };
}

function viewerFor(auth: AuthUser, rep: { email?: string | null; name?: string | null } | undefined) {
  return {
    manager: Boolean(auth.isAdmin || auth.canViewAllCalls),
    callRep: Boolean(rep && isOwnRep(rep, toCallViewer(auth))),
  };
}

async function presentApplication(application: ApplicationRow, template: TemplateRow, manager: boolean) {
  const questions = await questionsFor(application.templateId);
  const answers = await db.select().from(scorecardAnswers)
    .where(and(scoped(scorecardAnswers), eq(scorecardAnswers.applicationId, application.id))).all();
  return {
    id: application.id,
    templateId: template.id,
    templateName: template.name,
    description: template.description,
    visibility: template.visibility,
    source: application.source,
    status: application.status,
    overallScore: application.overallScore ?? null,
    answeredCount: application.answeredCount,
    questionCount: application.questionCount,
    appliedAt: application.appliedAt,
    readOnly: !manager,
    questions: questions.map((question: QuestionRow) => {
      const answer = answers.find((row: { questionId: string }) => row.questionId === question.id);
      return {
        ...presentQuestion(question),
        answer: answer ? {
          value: answer.value, note: answer.note, origin: answer.origin, authorName: answer.authorName, updatedAt: answer.updatedAt,
        } : null,
      };
    }),
  };
}

export async function listCallScorecards(auth: AuthUser, callId: string) {
  await ensureRevenueSchema();
  const call = await accessibleCall(auth, callId);
  const reps = await listRepIdentities();
  const viewer = viewerFor(auth, reps.find((rep) => rep.id === call.repId));
  const applications = await db.select().from(scorecardApplications)
    .where(and(scoped(scorecardApplications), eq(scorecardApplications.callId, callId)))
    .orderBy(asc(scorecardApplications.appliedAt)).all();
  const templateIds = [...new Set(applications.map((row: ApplicationRow) => row.templateId))] as string[];
  const templates = (templateIds.length
    ? await db.select().from(scorecardTemplates).where(and(scoped(scorecardTemplates), inArray(scorecardTemplates.id, templateIds))).all()
    : []) as TemplateRow[];
  const byId = new Map<string, TemplateRow>(templates.map((row) => [row.id, row]));
  const visible = [];
  for (const application of applications) {
    const template = byId.get(application.templateId);
    if (!template || !isScoreVisibility(template.visibility) || !canViewScorecard(template.visibility, viewer)) continue;
    visible.push(await presentApplication(application, template, viewer.manager));
  }
  let availableTemplates: { id: string; name: string }[] = [];
  if (viewer.manager) {
    const active = await db.select({ id: scorecardTemplates.id, name: scorecardTemplates.name }).from(scorecardTemplates)
      .where(and(scoped(scorecardTemplates), eq(scorecardTemplates.archived, false))).orderBy(asc(scorecardTemplates.name)).all();
    const applied = new Set(applications.map((row: ApplicationRow) => row.templateId));
    availableTemplates = active.filter((row: { id: string }) => !applied.has(row.id));
  }
  return { applications: visible, availableTemplates };
}

export async function applyScorecardToCall(auth: AuthUser, callId: string, templateId: string) {
  if (!auth.isAdmin) throw new RevenueError("Only a manager can apply a scorecard.", 403);
  await ensureRevenueSchema();
  await accessibleCall(auth, callId);
  const template = await templateById(templateId);
  if (!template || template.archived) throw new RevenueError("Scorecard not found.", 404);
  const result = await ensureApplication(template, callId, "manual", actorName(auth));
  const listed = await listCallScorecards(auth, callId);
  return { ...result, ...listed };
}

async function applicationForCall(callId: string, applicationId: string): Promise<ApplicationRow> {
  const application = await db.select().from(scorecardApplications)
    .where(and(scoped(scorecardApplications), eq(scorecardApplications.id, applicationId), eq(scorecardApplications.callId, callId))).get();
  if (!application) throw new RevenueError("Scorecard not found on this call.", 404);
  return application;
}

export async function saveCallScorecardAnswer(auth: AuthUser, callId: string, body: any) {
  if (!auth.isAdmin) throw new RevenueError("Only a manager can score a call.", 403);
  await ensureRevenueSchema();
  await accessibleCall(auth, callId);
  const application = await applicationForCall(callId, String(body.applicationId || ""));
  const questions = await questionsFor(application.templateId);
  const question = questions.find((row: QuestionRow) => row.id === body.questionId);
  if (!question || !isScoreScale(question.scale)) throw new RevenueError("Question not found.", 404);
  const value = typeof body.value === "string" || typeof body.value === "number" ? String(body.value).trim().toLowerCase() : "";
  const stored = question.scale === "pass_fail"
    ? (value === "pass" || value === "yes" ? "pass" : value === "fail" || value === "no" ? "fail" : "")
    : value;
  if (!answerFitsScale(question.scale, stored)) {
    throw new RevenueError(question.scale === "pass_fail" ? "Choose pass or fail." : "Choose a score from 1 to 5.");
  }
  const note = textInput(body.note || "", "Note", 2000, false);
  await upsertAnswer(application.id, question.id, stored, note, "manual", actorName(auth));
  await recompute(application.id);
  if (question.rubricKey) {
    const score = coachingScoreFromAnswer(question.scale, stored);
    if (score != null) await writeLinkedOverride(callId, question.rubricKey, score, actorName(auth), question.prompt, note);
  }
  return listCallScorecards(auth, callId);
}

export async function submitCallScorecard(auth: AuthUser, callId: string, applicationId: string) {
  if (!auth.isAdmin) throw new RevenueError("Only a manager can submit a scorecard.", 403);
  await ensureRevenueSchema();
  await accessibleCall(auth, callId);
  const application = await applicationForCall(callId, applicationId);
  await recompute(application.id);
  const current = await applicationForCall(callId, applicationId);
  if (current.answeredCount !== current.questionCount || current.questionCount === 0) {
    throw new RevenueError("Answer every question before submitting.");
  }
  await db.update(scorecardApplications).set({ status: "submitted", updatedAt: nowIso() })
    .where(and(scoped(scorecardApplications), eq(scorecardApplications.id, application.id))).run();
  return listCallScorecards(auth, callId);
}

/** Apply every active automatic scorecard whose team, script, and source filters match this call. */
export async function autoApplyScorecardsForCall(callId: string): Promise<number> {
  await ensureRevenueSchema();
  const orgId = currentTenantId();
  const call = await db.select({ id: calls.id, repId: calls.repId, callStage: calls.callStage }).from(calls)
    .where(and(eq(calls.orgId, orgId), eq(calls.id, callId))).get();
  if (!call) return 0;
  const meta = await db.select({ source: callMetadata.source }).from(callMetadata)
    .where(and(eq(callMetadata.orgId, orgId), eq(callMetadata.callId, callId))).get();
  const teams = await loadGoalTeams();
  const context = {
    stage: call.callStage,
    source: meta?.source || "upload",
    teamIds: teams.filter((team) => team.repIds.includes(call.repId)).map((team) => team.id),
  };
  const templates = await db.select().from(scorecardTemplates)
    .where(and(eq(scorecardTemplates.orgId, orgId), eq(scorecardTemplates.autoApply, true), eq(scorecardTemplates.archived, false))).all();
  let created = 0;
  for (const template of templates) {
    if (!callMatchesFilters(parseFilters(template.filters), context)) continue;
    const result = await ensureApplication(template, callId, "auto", "auto");
    if (result.created) created++;
  }
  return created;
}

export async function seedScorecardsFromRubric(callId: string) {
  await ensureRevenueSchema();
  const applications = await db.select({ id: scorecardApplications.id }).from(scorecardApplications)
    .where(and(scoped(scorecardApplications), eq(scorecardApplications.callId, callId))).all();
  for (const application of applications) await seedApplicationFromRubric(application.id);
}

/** Manager corrections on the coaching scorecard update linked structured answers. */
export async function applyCorrectionToScorecards(callId: string, metricKey: string, score: number, author: string) {
  await ensureRevenueSchema();
  const applications = await db.select().from(scorecardApplications)
    .where(and(scoped(scorecardApplications), eq(scorecardApplications.callId, callId))).all();
  for (const application of applications) {
    const questions = (await questionsFor(application.templateId)).filter((question: QuestionRow) => question.rubricKey === metricKey);
    let changed = false;
    for (const question of questions) {
      const value = answerFromRubric(question.scale as ScoreScale, { score, status: null });
      if (!value) continue;
      const existing = await db.select().from(scorecardAnswers).where(and(
        scoped(scorecardAnswers), eq(scorecardAnswers.applicationId, application.id), eq(scorecardAnswers.questionId, question.id),
      )).get();
      await upsertAnswer(application.id, question.id, value, existing?.note || "", "correction", author);
      changed = true;
    }
    if (changed) await recompute(application.id);
  }
}

export async function resyncScorecardAfterCorrectionRemoved(callId: string, metricKey: string) {
  await ensureRevenueSchema();
  const signals = await signalsForCall(callId);
  const applications = await db.select().from(scorecardApplications)
    .where(and(scoped(scorecardApplications), eq(scorecardApplications.callId, callId))).all();
  for (const application of applications) {
    const questions = (await questionsFor(application.templateId)).filter((question: QuestionRow) => question.rubricKey === metricKey);
    let changed = false;
    for (const question of questions) {
      const existing = await db.select().from(scorecardAnswers).where(and(
        scoped(scorecardAnswers), eq(scorecardAnswers.applicationId, application.id), eq(scorecardAnswers.questionId, question.id),
      )).get();
      if (!existing || existing.origin !== "correction") continue;
      const value = answerFromRubric(question.scale as ScoreScale, signals.get(metricKey));
      if (!value) {
        await db.delete(scorecardAnswers).where(and(scoped(scorecardAnswers), eq(scorecardAnswers.id, existing.id))).run();
      } else {
        await upsertAnswer(application.id, question.id, value, existing.note || "", "rubric", "Coaching rubric");
      }
      changed = true;
    }
    if (changed) await recompute(application.id);
  }
}

import { db } from "./index";
import { isSecretSetting, sealSetting, openSetting } from "../setting-secrets";
import { reps, calls, evaluations, repSnapshots, appSettings, scripts, repPersonas } from "./schema";
import { and, eq, desc, sql } from "drizzle-orm";
import type {
  Rep,
  Call,
  CallEvaluation,
  SuperAdminReport,
  RepTrajectory,
  SandlerStatus,
  MissedOpportunity,
  PriorityFix,
  SalesScript,
  RepPersona,
  ExecutiveAnalytics,
  CallStage,
  CoachLesson
} from "@/types";
import { DEFAULT_SANDLER_INSTRUCTIONS, isDefaultSandlerInstructions } from "@/lib/sandlerCoach";
import { isMethodId, methodById } from "@/lib/salesMethods";
import {
  formatWeightDirective,
  mergeIncomingWeights,
  readStoredWeights,
  weightsForMethod,
} from "@/lib/scoreWeights";
import type { SalesMethodology } from "@/lib/methodology";
import { tallyCookbookFunnel } from "@/lib/cookbookFunnel";
import {
  dialLogTranscript,
  dialOutcomeLabel,
  isDialAttempt,
  isQuickDialLog,
  isDialOutcome,
  resolveDialOutcome,
  tallyDialFunnel,
  type DialFact,
  type DialOutcome,
} from "@/lib/dialFunnel";
import { mergeCallStages, normalizeStageName, stagesEqual } from "@/lib/callStages";
import { hydrateEvaluation, latestEvaluationRow, latestEvaluationsByCall, type EvaluationRow } from "@/lib/evaluations";
import { isUnusableTranscript } from "@/lib/transcript";
import { normalizeCoreOutcome, tallyOutcomeBucket } from "@/lib/coreOutcome";
import { buildManagerTalkTrack } from "@/lib/managerTalkTrack";
import type { ManagerTalkTrack } from "@/lib/managerTalkTrack";
import {
  LOCAL_TENANT_ID,
  currentTenantId,
  parseTenantSettingKey,
  settingStorageKey,
} from "@/lib/tenant";

function tenantId(): string {
  return currentTenantId();
}

function forTenant(column: { orgId?: unknown } | any) {
  return eq(column, tenantId());
}

async function readRawSetting(key: string): Promise<string | null> {
  const row = await db.select().from(appSettings).where(eq(appSettings.key, key)).get();
  if (!row) return null;
  return openAndUpgradeSetting(key, row.value);
}

async function openAndUpgradeSetting(key: string, stored: string): Promise<string> {
  const value = openSetting(key, stored);
  // Upgrade legacy plaintext atomically, so a concurrent credential change is not overwritten.
  if (isSecretSetting(key) && value && !stored.startsWith("v1.")) {
    await db.update(appSettings).set({ value: sealSetting(key, value), updatedAt: new Date().toISOString() })
      .where(and(eq(appSettings.key, key), eq(appSettings.value, stored))).run();
  }
  return value;
}

async function writeRawSetting(key: string, value: string): Promise<void> {
  const sealed = sealSetting(key, value);
  const updatedAt = new Date().toISOString();
  await db.insert(appSettings).values({ key, value: sealed, updatedAt })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: sealed, updatedAt } }).run();
}

const GLOBAL_SETTING_KEYS = new Set(["tenant_backfill_org_id"]);

export function isGlobalSettingKey(key: string): boolean {
  return GLOBAL_SETTING_KEYS.has(key) || key.startsWith("stripe:") || key.startsWith("clerk:");
}

function canReadUnprefixedSettings(org: string): boolean {
  if (org === LOCAL_TENANT_ID) return true;
  const legacy = process.env.LEGACY_TENANT_ORG_ID?.trim();
  return Boolean(legacy && legacy === org);
}

// --- Settings Service ---
export async function getSetting(key: string): Promise<string | null> {
  if (isGlobalSettingKey(key)) {
    return readRawSetting(key);
  }
  const org = tenantId();
  const scoped = await readRawSetting(settingStorageKey(org, key));
  if (scoped != null) return scoped;
  if (canReadUnprefixedSettings(org)) {
    return readRawSetting(key);
  }
  return null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  if (isGlobalSettingKey(key)) {
    await writeRawSetting(key, value);
    return;
  }
  await writeRawSetting(settingStorageKey(tenantId(), key), value);
}

/** Compare-and-swap public settings in the database, shared by every Worker. */
export async function compareAndSetSetting(key: string, expected: string | null, value: string): Promise<boolean> {
  if (isSecretSetting(key) || isGlobalSettingKey(key)) throw new Error("Only public tenant settings support compare-and-swap.");
  const storageKey = settingStorageKey(tenantId(), key);
  const scoped = await db.select().from(appSettings).where(eq(appSettings.key, storageKey)).get();
  const current = scoped ? scoped.value : await getSetting(key);
  if (current !== expected) return false;
  const updatedAt = new Date().toISOString();
  const row = scoped
    ? await db.update(appSettings).set({ value, updatedAt })
      .where(and(eq(appSettings.key, storageKey), eq(appSettings.value, expected!)))
      .returning({ key: appSettings.key }).get()
    : await db.insert(appSettings).values({ key: storageKey, value, updatedAt })
      .onConflictDoNothing().returning({ key: appSettings.key }).get();
  return Boolean(row);
}

export async function getGlobalSetting(key: string): Promise<string | null> {
  if (!isGlobalSettingKey(key)) {
    throw new Error(`Refusing to read non-global setting ${key}`);
  }
  return readRawSetting(key);
}

export async function setGlobalSetting(key: string, value: string): Promise<void> {
  if (!isGlobalSettingKey(key)) {
    throw new Error(`Refusing to write non-global setting ${key}`);
  }
  await writeRawSetting(key, value);
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const org = tenantId();
  const rows = await db.select().from(appSettings).all();
  const res: Record<string, string> = {};
  for (const r of rows as { key: string; value: string }[]) {
    if (isGlobalSettingKey(r.key)) continue;
    const scopedKey = parseTenantSettingKey(r.key, org);
    if (scopedKey) {
      res[scopedKey] = await openAndUpgradeSetting(r.key, r.value) || "";
      continue;
    }
    if (!r.key.startsWith("t:") && canReadUnprefixedSettings(org) && res[r.key] === undefined) {
      res[r.key] = await openAndUpgradeSetting(r.key, r.value) || "";
    }
  }
  return res;
}

// --- Coach Service (manager-authored coaching philosophy + lessons) ---
// Stored in app_settings so no schema migration is required.
// Empty / unset instructions fall back to the Sandler Selling System default.
export async function getStoredCoachInstructions(): Promise<string> {
  return (await getSetting("coach_instructions")) || "";
}

export async function getSalesMethodId(): Promise<import("@/lib/methodology").MethodId> {
  const stored = await getSetting("coach_methodology");
  return isMethodId(stored) ? stored : "sandler";
}

export async function setSalesMethodId(id: string): Promise<void> {
  await setSetting("coach_methodology", isMethodId(id) ? id : "sandler");
}

const SCORE_WEIGHTS_KEY = "score_weights";

export async function getScoreWeights(method?: SalesMethodology): Promise<Record<string, number>> {
  const active = method ?? methodById(await getSalesMethodId());
  return weightsForMethod(readStoredWeights(await getSetting(SCORE_WEIGHTS_KEY)), active);
}

export async function setScoreWeights(incoming: unknown): Promise<Record<string, number>> {
  const method = methodById(await getSalesMethodId());
  const next = mergeIncomingWeights(readStoredWeights(await getSetting(SCORE_WEIGHTS_KEY)), incoming);
  await setSetting(SCORE_WEIGHTS_KEY, JSON.stringify(next));
  return weightsForMethod(next, method);
}

export async function getCoachInstructions(): Promise<string> {
  const stored = await getStoredCoachInstructions();
  if (stored.trim()) return stored;
  return methodById(await getSalesMethodId()).narrative || DEFAULT_SANDLER_INSTRUCTIONS;
}

export async function setCoachInstructions(text: string): Promise<void> {
  const trimmed = (text || "").trim();
  const narrative = (methodById(await getSalesMethodId()).narrative || DEFAULT_SANDLER_INSTRUCTIONS).trim();
  await setSetting("coach_instructions", !trimmed || trimmed === narrative ? "" : trimmed);
}

export async function coachUsesDefaultSandler(): Promise<boolean> {
  const stored = (await getStoredCoachInstructions()).trim();
  if (!stored) return true;
  const narrative = (methodById(await getSalesMethodId()).narrative || "").trim();
  return stored === narrative || isDefaultSandlerInstructions(stored);
}

export async function getCoachLessons(): Promise<CoachLesson[]> {
  const raw = await getSetting("coach_lessons");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CoachLesson[]) : [];
  } catch {
    return [];
  }
}

async function saveCoachLessons(lessons: CoachLesson[]): Promise<void> {
  await setSetting("coach_lessons", JSON.stringify(lessons));
}

export async function addCoachLesson(text: string, sourceCallId?: string): Promise<CoachLesson> {
  const lessons = await getCoachLessons();
  const lesson: CoachLesson = {
    id: `lesson_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    text: text.trim(),
    sourceCallId,
    createdAt: new Date().toISOString(),
  };
  lessons.unshift(lesson);
  await saveCoachLessons(lessons);
  return lesson;
}

export async function deleteCoachLesson(id: string): Promise<void> {
  const lessons = await getCoachLessons();
  await saveCoachLessons(lessons.filter((l) => l.id !== id));
}

// Builds the manager's coaching directives block injected into every evaluation.
export async function getCoachContext(): Promise<string> {
  const instructions = (await getCoachInstructions()).trim();
  const lessons = await getCoachLessons();
  const parts: string[] = [];
  if (instructions) {
    parts.push(`Coaching philosophy & what matters most to this manager:\n${instructions}`);
  }
  if (lessons.length) {
    parts.push(
      `Specific lessons the manager has taught (apply these when judging the call):\n` +
        lessons.map((l, i) => `${i + 1}. ${l.text}`).join("\n")
    );
  }
  const method = methodById(await getSalesMethodId());
  const weightDirective = formatWeightDirective(method, await getScoreWeights(method));
  if (weightDirective) parts.push(weightDirective);
  return parts.join("\n\n");
}

// --- Scripts / Playbooks Service ---
export async function getAllScripts(): Promise<SalesScript[]> {
  const rows = await db.select().from(scripts).where(forTenant(scripts.orgId)).all();
  return rows.map((r: any) => ({
    id: r.id,
    stage: r.stage as CallStage,
    title: r.title,
    content: r.content,
    keyMilestones: JSON.parse(r.keyMilestones || "[]"),
    isActive: Boolean(r.isActive),
    updatedAt: r.updatedAt,
  }));
}

export async function getActiveScriptForStage(stage: string): Promise<SalesScript | null> {
  const all = await getAllScripts();
  return all.find((s) => s.stage.toLowerCase() === stage.toLowerCase() && s.isActive) || null;
}

export async function saveScript(scriptData: Omit<SalesScript, "updatedAt">): Promise<SalesScript> {
  const updatedAt = new Date().toISOString();
  scriptData = { ...scriptData, stage: normalizeStageName(scriptData.stage) };
  if (!scriptData.stage) {
    throw new Error("Call Stage Target is required.");
  }
  await addCallStage(scriptData.stage);
  const existing = await db.select().from(scripts).where(and(eq(scripts.id, scriptData.id), forTenant(scripts.orgId))).get();

  if (existing) {
    await db.update(scripts)
      .set({
        stage: scriptData.stage,
        title: scriptData.title,
        content: scriptData.content,
        keyMilestones: JSON.stringify(scriptData.keyMilestones),
        isActive: scriptData.isActive,
        updatedAt,
      })
      .where(and(eq(scripts.id, scriptData.id), forTenant(scripts.orgId)))
      .run();
  } else {
    await db.insert(scripts).values({
      id: scriptData.id,
      orgId: tenantId(),
      stage: scriptData.stage,
      title: scriptData.title,
      content: scriptData.content,
      keyMilestones: JSON.stringify(scriptData.keyMilestones),
      isActive: scriptData.isActive,
      updatedAt,
    }).run();
  }

  return {
    ...scriptData,
    updatedAt,
  };
}

export async function deleteScript(id: string): Promise<void> {
  await db.delete(scripts).where(and(eq(scripts.id, id), forTenant(scripts.orgId))).run();
}

const CALL_STAGES_KEY = "call_stages";

async function getStoredCallStages(): Promise<string[] | null> {
  const raw = await getSetting(CALL_STAGES_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.map((s) => normalizeStageName(String(s))).filter(Boolean);
  } catch {
    return null;
  }
}

async function persistCallStages(stages: string[]): Promise<void> {
  await setSetting(CALL_STAGES_KEY, JSON.stringify(stages));
}

export async function getCallStages(): Promise<string[]> {
  const stored = await getStoredCallStages();
  const allScripts = await getAllScripts();
  const scriptStages = allScripts.map((s) => s.stage);
  // Once a manager has saved a stage list, don't resurrect deleted types from old calls.
  if (stored && stored.length > 0) {
    return mergeCallStages(stored, scriptStages, []);
  }
  const allCalls = await db.select({ callStage: calls.callStage }).from(calls).where(forTenant(calls.orgId)).all();
  return mergeCallStages(
    stored,
    scriptStages,
    allCalls.map((c: { callStage: string }) => c.callStage)
  );
}

export async function addCallStage(name: string): Promise<string[]> {
  const stage = normalizeStageName(name).slice(0, 60).trim();
  if (!stage) throw new Error("Call Stage Target is required.");
  const current = await getCallStages();
  if (current.some((s) => stagesEqual(s, stage))) return current;
  if (current.length >= 50) return current;
  const next = [...current, stage];
  await persistCallStages(next);
  return next;
}

export async function renameCallStage(from: string, to: string): Promise<string[]> {
  const source = normalizeStageName(from);
  const target = normalizeStageName(to);
  if (!source) throw new Error("Current Call Stage Target is required.");
  if (!target) throw new Error("Updated Call Stage Target is required.");
  if (stagesEqual(source, target) && source === target) return getCallStages();

  const current = await getCallStages();
  if (!current.some((s) => stagesEqual(s, source))) {
    throw new Error(`Unknown Call Stage Target: ${source}`);
  }
  if (!stagesEqual(source, target) && current.some((s) => stagesEqual(s, target))) {
    throw new Error(`A Call Stage Target named "${target}" already exists.`);
  }

  const next = current.map((s) => (stagesEqual(s, source) ? target : s));
  await persistCallStages(next);

  const matchingScripts = (await getAllScripts()).filter((s) => stagesEqual(s.stage, source));
  for (const script of matchingScripts) {
    await db.update(scripts).set({ stage: target, updatedAt: new Date().toISOString() }).where(and(eq(scripts.id, script.id), forTenant(scripts.orgId))).run();
  }

  const matchingCalls = await db.select().from(calls).where(forTenant(calls.orgId)).all();
  for (const call of matchingCalls) {
    if (stagesEqual(call.callStage, source)) {
      await db.update(calls).set({ callStage: target }).where(and(eq(calls.id, call.id), forTenant(calls.orgId))).run();
    }
  }

  return next;
}

export async function deleteCallStage(name: string): Promise<string[]> {
  const stage = normalizeStageName(name);
  if (!stage) throw new Error("Call Stage Target is required.");
  const allScripts = await getAllScripts();
  if (allScripts.some((s) => stagesEqual(s.stage, stage))) {
    throw new Error("Cannot remove a Call Stage Target that still has scripts. Move or delete those scripts first.");
  }
  const current = await getCallStages();
  const next = current.filter((s) => !stagesEqual(s, stage));
  if (next.length === 0) {
    throw new Error("Keep at least one Call Stage Target.");
  }
  await persistCallStages(next);
  return next;
}

// --- Rep Persona Service ---
export async function getRepPersona(repId: string): Promise<RepPersona | null> {
  const row = await db.select().from(repPersonas).where(and(eq(repPersonas.repId, repId), forTenant(repPersonas.orgId))).get();
  if (!row) return null;
  return {
    id: row.id,
    repId: row.repId,
    experienceLevel: row.experienceLevel,
    coachingTone: row.coachingTone,
    knownBlindspots: JSON.parse(row.knownBlindspots || "[]"),
    strengths: JSON.parse(row.strengths || "[]"),
    managerNotes: row.managerNotes,
    targetQuota: row.targetQuota || undefined,
    updatedAt: row.updatedAt,
  };
}

export async function saveRepPersona(persona: RepPersona): Promise<RepPersona> {
  const updatedAt = new Date().toISOString();
  const id = persona.id || `persona_${persona.repId}`;
  const existing = await db.select().from(repPersonas).where(and(eq(repPersonas.repId, persona.repId), forTenant(repPersonas.orgId))).get();

  if (existing) {
    await db.update(repPersonas)
      .set({
        experienceLevel: persona.experienceLevel,
        coachingTone: persona.coachingTone,
        knownBlindspots: JSON.stringify(persona.knownBlindspots),
        strengths: JSON.stringify(persona.strengths),
        managerNotes: persona.managerNotes,
        targetQuota: persona.targetQuota,
        updatedAt,
      })
      .where(and(eq(repPersonas.repId, persona.repId), forTenant(repPersonas.orgId)))
      .run();
  } else {
    await db.insert(repPersonas).values({
      id,
      orgId: tenantId(),
      repId: persona.repId,
      experienceLevel: persona.experienceLevel,
      coachingTone: persona.coachingTone,
      knownBlindspots: JSON.stringify(persona.knownBlindspots),
      strengths: JSON.stringify(persona.strengths),
      managerNotes: persona.managerNotes,
      targetQuota: persona.targetQuota,
      updatedAt,
    }).run();
  }

  return {
    ...persona,
    id,
    updatedAt,
  };
}

// Resolve a rep by id, or create one from a name (the app has no separate rep
// CRUD, so uploads create reps on demand). Returns the rep id to attach calls to.
export async function listRepIdentities(): Promise<{ id: string; name: string; email: string }[]> {
  const rows = await db.select().from(reps).where(forTenant(reps.orgId)).all();
  return rows.map((r: { id: string; name: string; email: string }) => ({
    id: r.id,
    name: r.name,
    email: r.email,
  }));
}

export async function getOrCreateRep(
  repId?: string,
  repName?: string,
  repRole?: string,
  repEmail?: string
): Promise<string> {
  if (repId && repId !== "new") {
    const existing = await db.select().from(reps).where(and(eq(reps.id, repId), forTenant(reps.orgId))).get();
    if (existing) return existing.id;
  }

  const email = (repEmail || "").trim().toLowerCase();
  const name = (repName || "").trim();
  const all = await db.select().from(reps).where(forTenant(reps.orgId)).all();
  if (email) {
    const byEmail = all.find((r: any) => (r.email || "").toLowerCase() === email);
    if (byEmail) return byEmail.id;
  }
  if (name && !email) {
    const match = all.find(
      (r: any) => r.name.toLowerCase() === name.toLowerCase()
    );
    if (match) return match.id;
  }

  const slug =
    (name || email.split("@")[0] || "rep")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 24) || "rep";
  const id = `rep_${slug}_${crypto.randomUUID()}`;

  await db
    .insert(reps)
    .values({
      id,
      orgId: tenantId(),
      name: name || "New Rep",
      email: email || `${slug}@company.io`,
      role: (repRole || "").trim() || "Sales Rep",
      avatarUrl: null,
      createdAt: new Date().toISOString(),
    })
    .run();

  return id;
}

// Set what a rep should work on. Stored as the rep persona's manager notes,
// which the coach already injects when evaluating that rep's calls.
export async function setRepFocus(repId: string, focus: string): Promise<void> {
  const text = (focus || "").trim();
  if (!text) return;
  const existing = await getRepPersona(repId);
  await saveRepPersona({
    repId,
    experienceLevel: existing?.experienceLevel || "Not specified",
    coachingTone: existing?.coachingTone || "Direct & tactical",
    knownBlindspots: existing?.knownBlindspots || [],
    strengths: existing?.strengths || [],
    managerNotes: text,
    targetQuota: existing?.targetQuota,
  });
}

// --- Reps & Calls ---

function personaFromRow(row: {
  id: string;
  repId: string;
  experienceLevel: string;
  coachingTone: string;
  knownBlindspots: string;
  strengths: string;
  managerNotes: string;
  targetQuota: string | null;
  updatedAt: string;
}): RepPersona {
  return {
    id: row.id,
    repId: row.repId,
    experienceLevel: row.experienceLevel,
    coachingTone: row.coachingTone,
    knownBlindspots: JSON.parse(row.knownBlindspots || "[]"),
    strengths: JSON.parse(row.strengths || "[]"),
    managerNotes: row.managerNotes,
    targetQuota: row.targetQuota || undefined,
    updatedAt: row.updatedAt,
  };
}

function latestEvalByCall(rows: EvaluationRow[]): Map<string, EvaluationRow> {
  const latest = new Map<string, EvaluationRow>();
  for (const row of rows) {
    const existing = latest.get(row.callId);
    if (!existing || row.createdAt > existing.createdAt) latest.set(row.callId, row);
  }
  return latest;
}

function dialFactFromRow(row: {
  coreOutcome?: string | null;
  dialOutcome?: string | null;
  transcriptText?: string | null;
  transcriptProbe?: string | null;
  callStage?: string | null;
}): DialFact {
  const probe = row.transcriptText ?? row.transcriptProbe ?? "";
  return {
    dialOutcome: row.dialOutcome,
    coreOutcome: row.coreOutcome,
    callStage: row.callStage,
    hasConversation: !isUnusableTranscript(probe),
  };
}

function funnelFields(facts: DialFact[]) {
  const summary = tallyDialFunnel(facts);
  return {
    totalCalls: summary.dials,
    connectRate: summary.connectRate,
    closeRate: summary.closeRate,
    closePerConnect: summary.closePerConnect,
    bookedRate: Math.round(summary.closeRate),
    funnel: {
      dials: summary.dials,
      connects: summary.connects,
      conversations: summary.conversations,
      meetings: summary.meetings,
      closes: summary.closes,
      connectRate: summary.connectRate,
      closeRate: summary.closeRate,
      closePerConnect: summary.closePerConnect,
    },
  };
}

export async function listDialFacts(): Promise<({ repId: string; outcome: DialOutcome } & DialFact)[]> {
  const rows = await db
    .select({
      repId: calls.repId,
      callStage: calls.callStage,
      coreOutcome: calls.coreOutcome,
      dialOutcome: calls.dialOutcome,
      transcriptProbe: sql<string>`substr(${calls.transcriptText}, 1, 2000)`,
    })
    .from(calls)
    .where(forTenant(calls.orgId))
    .all();
  return (rows as { repId: string; callStage: string; coreOutcome: string; dialOutcome: string | null; transcriptProbe: string }[])
    .map((row) => {
      const fact = dialFactFromRow(row);
      return { repId: row.repId, ...fact, outcome: resolveDialOutcome(fact) };
    })
    .filter((fact) => isDialAttempt(fact));
}

export async function insertDialLog(values: {
  id: string;
  repId: string;
  prospectCompany: string;
  prospectName: string;
  outcome: DialOutcome;
  createdAt: string;
}): Promise<void> {
  await db.insert(calls).values({
    id: values.id,
    orgId: tenantId(),
    repId: values.repId,
    prospectCompany: values.prospectCompany,
    prospectName: values.prospectName,
    callStage: "Cold Call",
    coreOutcome: dialOutcomeLabel(values.outcome),
    dialOutcome: values.outcome,
    durationSeconds: 0,
    transcriptText: dialLogTranscript(),
    status: "completed",
    createdAt: values.createdAt,
  }).run();
}

function missedCount(raw: string | null | undefined): number {
  if (!raw) return 0;
  try {
    const missed = JSON.parse(raw) as MissedOpportunity[];
    return Array.isArray(missed) ? missed.length : 0;
  } catch {
    return 0;
  }
}

export async function getAllReps(): Promise<Rep[]> {
  const [allReps, callRows, evalRows, allSnapshots, personaRows] = await Promise.all([
    db.select().from(reps).where(forTenant(reps.orgId)).all(),
    db
      .select({
        id: calls.id,
        repId: calls.repId,
        callStage: calls.callStage,
        coreOutcome: calls.coreOutcome,
        dialOutcome: calls.dialOutcome,
        transcriptProbe: sql<string>`substr(${calls.transcriptText}, 1, 2000)`,
      })
      .from(calls)
      .where(forTenant(calls.orgId))
      .all(),
    db
      .select({
        callId: evaluations.callId,
        repId: evaluations.repId,
        painStatus: evaluations.painStatus,
        budgetStatus: evaluations.budgetStatus,
        decisionStatus: evaluations.decisionStatus,
        scriptAdherenceScore: evaluations.scriptAdherenceScore,
        missedOpportunities: evaluations.missedOpportunities,
        createdAt: evaluations.createdAt,
      })
      .from(evaluations)
      .where(forTenant(evaluations.orgId))
      .all(),
    db.select().from(repSnapshots).where(forTenant(repSnapshots.orgId)).all(),
    db.select().from(repPersonas).where(forTenant(repPersonas.orgId)).all(),
  ]);

  const usableIds = new Set<string>();
  const factsByRep = new Map<string, DialFact[]>();
  for (const row of callRows as { id: string; repId: string; callStage: string; coreOutcome: string; dialOutcome: string | null; transcriptProbe: string }[]) {
    const fact = dialFactFromRow(row);
    if (isDialAttempt(fact)) {
      const list = factsByRep.get(row.repId);
      if (list) list.push(fact);
      else factsByRep.set(row.repId, [fact]);
    }
    if (!isUnusableTranscript(row.transcriptProbe) && !isQuickDialLog({ dialOutcome: row.dialOutcome, transcriptText: row.transcriptProbe })) usableIds.add(row.id);
  }

  type RepMetricEval = {
    callId: string;
    repId: string;
    painStatus: string;
    budgetStatus: string;
    decisionStatus: string;
    scriptAdherenceScore: number;
    missedOpportunities: string | null;
    createdAt: string;
  };
  const evalsByRep = new Map<string, RepMetricEval[]>();
  for (const row of evalRows as RepMetricEval[]) {
    if (!usableIds.has(row.callId)) continue;
    const list = evalsByRep.get(row.repId);
    if (list) list.push(row);
    else evalsByRep.set(row.repId, [row]);
  }

  const snapshotByRep = new Map<string, { overallTrajectory?: string; managerRationale?: string }>();
  for (const row of allSnapshots as { repId: string; overallTrajectory?: string; managerRationale?: string }[]) {
    snapshotByRep.set(row.repId, row);
  }
  const personaByRep = new Map<string, RepPersona>();
  for (const row of personaRows as Parameters<typeof personaFromRow>[0][]) {
    personaByRep.set(row.repId, personaFromRow(row));
  }

  return allReps.map((r: any) => {
    const repEvals = latestEvaluationsByCall<RepMetricEval>(evalsByRep.get(r.id) || []);
    const snapshot = snapshotByRep.get(r.id);

    let painPassCount = 0;
    let budgetPassCount = 0;
    let decisionPassCount = 0;
    let totalScore = 0;
    let earlyFoldCount = 0;
    const rates = funnelFields(factsByRep.get(r.id) || []);

    for (const ev of repEvals) {
      if (ev.painStatus === "Pass") painPassCount++;
      if (ev.budgetStatus === "Pass") budgetPassCount++;
      if (ev.decisionStatus === "Pass") decisionPassCount++;
      totalScore += ev.scriptAdherenceScore;
      earlyFoldCount += missedCount(ev.missedOpportunities);
    }

    return {
      id: r.id,
      name: r.name,
      email: r.email,
      role: r.role,
      avatarUrl: r.avatarUrl || undefined,
      createdAt: r.createdAt,
      trajectory: (snapshot?.overallTrajectory as RepTrajectory) || "stagnant",
      trajectoryReason: snapshot?.managerRationale || "Baseline evaluation in progress.",
      totalCalls: rates.totalCalls,
      avgScriptScore: repEvals.length ? Math.round((totalScore / repEvals.length) * 10) / 10 : 0,
      painPassRate: repEvals.length ? Math.round((painPassCount / repEvals.length) * 100) : 0,
      budgetPassRate: repEvals.length ? Math.round((budgetPassCount / repEvals.length) * 100) : 0,
      decisionPassRate: repEvals.length ? Math.round((decisionPassCount / repEvals.length) * 100) : 0,
      earlyFoldCount,
      bookedRate: rates.bookedRate,
      connectRate: rates.connectRate,
      closeRate: rates.closeRate,
      closePerConnect: rates.closePerConnect,
      funnel: rates.funnel,
      persona: personaByRep.get(r.id),
    };
  });
}

export async function getRepById(id: string): Promise<{
  rep: Rep | null;
  calls: Call[];
  snapshot: any | null;
  talkTrack: ManagerTalkTrack | null;
}> {
  const repRecord = await db.select().from(reps).where(and(eq(reps.id, id), forTenant(reps.orgId))).get();
  if (!repRecord) return { rep: null, calls: [], snapshot: null, talkTrack: null };

  const [repCalls, repEvals, snapshot, persona] = await Promise.all([
    db.select().from(calls).where(and(eq(calls.repId, id), forTenant(calls.orgId))).orderBy(desc(calls.createdAt)).all(),
    db.select().from(evaluations).where(and(eq(evaluations.repId, id), forTenant(evaluations.orgId))).all(),
    db.select().from(repSnapshots).where(and(eq(repSnapshots.repId, id), forTenant(repSnapshots.orgId))).get(),
    getRepPersona(id),
  ]);

  const evalByCall = latestEvalByCall(repEvals);
  const fullCalls: Call[] = [];
  let painPassCount = 0;
  let budgetPassCount = 0;
  let decisionPassCount = 0;
  let totalScore = 0;
  let earlyFoldCount = 0;
  let evaluated = 0;
  const dialFacts: DialFact[] = [];

  for (const c of repCalls as any[]) {
    const fact = dialFactFromRow(c);
    if (isDialAttempt(fact)) dialFacts.push(fact);
    if (isUnusableTranscript(c.transcriptText) && !c.dialOutcome) continue;
    const ev = evalByCall.get(c.id);
    let evaluation: CallEvaluation | undefined = undefined;
    if (ev) {
      evaluated++;
      evaluation = hydrateEvaluation(ev, {
        repName: repRecord.name,
        callStage: c.callStage,
        coreOutcome: normalizeCoreOutcome(c.coreOutcome),
        transcriptText: c.transcriptText,
        durationSeconds: c.durationSeconds,
      });
      if (evaluation.sandlerBreakdown.pain.status === "Pass") painPassCount++;
      if (evaluation.sandlerBreakdown.budget.status === "Pass") budgetPassCount++;
      if (evaluation.sandlerBreakdown.decision.status === "Pass") decisionPassCount++;
      totalScore += evaluation.sandlerBreakdown.scriptAdherence.score;
      earlyFoldCount += evaluation.missedOpportunities.length;
    }

    fullCalls.push({
      id: c.id,
      repId: c.repId,
      repName: repRecord.name,
      prospectCompany: c.prospectCompany,
      prospectName: c.prospectName,
      callStage: c.callStage as any,
      coreOutcome: isDialOutcome(c.dialOutcome) ? dialOutcomeLabel(c.dialOutcome) : normalizeCoreOutcome(c.coreOutcome),
      dialOutcome: c.dialOutcome || null,
      durationSeconds: c.durationSeconds,
      transcriptText: c.transcriptText,
      audioUrl: c.audioUrl || undefined,
      status: c.status as any,
      createdAt: c.createdAt,
      evaluation,
    });
  }

  const rates = funnelFields(dialFacts);
  const computedRep: Rep = {
    id: repRecord.id,
    name: repRecord.name,
    email: repRecord.email,
    role: repRecord.role,
    createdAt: repRecord.createdAt,
    trajectory: (snapshot?.overallTrajectory as RepTrajectory) || "stagnant",
    trajectoryReason: snapshot?.managerRationale || "Baseline evaluation in progress.",
    totalCalls: rates.totalCalls,
    avgScriptScore: evaluated ? Math.round((totalScore / evaluated) * 10) / 10 : 0,
    painPassRate: evaluated ? Math.round((painPassCount / evaluated) * 100) : 0,
    budgetPassRate: evaluated ? Math.round((budgetPassCount / evaluated) * 100) : 0,
    decisionPassRate: evaluated ? Math.round((decisionPassCount / evaluated) * 100) : 0,
    earlyFoldCount,
    bookedRate: rates.bookedRate,
    connectRate: rates.connectRate,
    closeRate: rates.closeRate,
    closePerConnect: rates.closePerConnect,
    funnel: rates.funnel,
    persona: persona || undefined,
  };

  return {
    rep: computedRep,
    calls: fullCalls,
    snapshot,
    talkTrack: buildManagerTalkTrack(computedRep.name, fullCalls),
  };
}

export async function deleteCallsWithoutTranscript(): Promise<string[]> {
  const rows = await db.select({ id: calls.id, transcriptText: calls.transcriptText, dialOutcome: calls.dialOutcome }).from(calls).where(forTenant(calls.orgId)).all();
  const removed: string[] = [];
  for (const row of rows) {
    if (row.dialOutcome) continue;
    if (!isUnusableTranscript(row.transcriptText)) continue;
    await db.delete(evaluations).where(and(eq(evaluations.callId, row.id), forTenant(evaluations.orgId))).run();
    await db.delete(calls).where(and(eq(calls.id, row.id), forTenant(calls.orgId))).run();
    removed.push(row.id);
  }
  return removed;
}

export async function getCallSummaries(): Promise<Call[]> {
  return loadCalls(false);
}

export async function getAllCalls(): Promise<Call[]> {
  return loadCalls(true);
}

async function loadCalls(includeTranscript: boolean): Promise<Call[]> {
  const [callRows, repRows, evalRows] = await Promise.all([
    includeTranscript
      ? db.select().from(calls).where(forTenant(calls.orgId)).orderBy(desc(calls.createdAt)).all()
      : db
          .select({
            id: calls.id,
            repId: calls.repId,
            prospectCompany: calls.prospectCompany,
            prospectName: calls.prospectName,
            callStage: calls.callStage,
            coreOutcome: calls.coreOutcome,
            dialOutcome: calls.dialOutcome,
            durationSeconds: calls.durationSeconds,
            audioUrl: calls.audioUrl,
            status: calls.status,
            createdAt: calls.createdAt,
            transcriptProbe: sql<string>`substr(${calls.transcriptText}, 1, 2000)`,
          })
          .from(calls)
          .where(forTenant(calls.orgId))
          .orderBy(desc(calls.createdAt))
          .all(),
    db.select({ id: reps.id, name: reps.name }).from(reps).where(forTenant(reps.orgId)).all(),
    includeTranscript
      ? db.select().from(evaluations).where(forTenant(evaluations.orgId)).all()
      : db
          .select({
            id: evaluations.id,
            callId: evaluations.callId,
            repId: evaluations.repId,
            bottomLine: evaluations.bottomLine,
            painStatus: evaluations.painStatus,
            painEvidence: evaluations.painEvidence,
            budgetStatus: evaluations.budgetStatus,
            budgetEvidence: evaluations.budgetEvidence,
            decisionStatus: evaluations.decisionStatus,
            decisionEvidence: evaluations.decisionEvidence,
            scriptAdherenceScore: evaluations.scriptAdherenceScore,
            scriptFeedback: evaluations.scriptFeedback,
            scriptDivergence: evaluations.scriptDivergence,
            missedOpportunities: evaluations.missedOpportunities,
            topFixes: evaluations.topFixes,
            extendedReview: evaluations.extendedReview,
            createdAt: evaluations.createdAt,
          })
          .from(evaluations)
          .where(forTenant(evaluations.orgId))
          .all(),
  ]);

  const repNameById = new Map<string, string>();
  for (const row of repRows as { id: string; name: string }[]) {
    repNameById.set(row.id, row.name);
  }
  const evalByCall = latestEvalByCall(evalRows as EvaluationRow[]);
  const result: Call[] = [];

  for (const c of callRows as {
    id: string;
    repId: string;
    prospectCompany: string;
    prospectName: string;
    callStage: string;
    coreOutcome: string;
    dialOutcome?: string | null;
    durationSeconds: number;
    transcriptText?: string;
    transcriptProbe?: string;
    audioUrl?: string | null;
    status: string;
    createdAt: string;
  }[]) {
    const probe = includeTranscript ? c.transcriptText : c.transcriptProbe;
    if (isUnusableTranscript(probe) && !c.dialOutcome) continue;
    const repName = repNameById.get(c.repId) || "Unknown Rep";
    const ev = evalByCall.get(c.id);
    result.push({
      id: c.id,
      repId: c.repId,
      repName,
      prospectCompany: c.prospectCompany,
      prospectName: c.prospectName,
      callStage: c.callStage as any,
      coreOutcome: isDialOutcome(c.dialOutcome) ? dialOutcomeLabel(c.dialOutcome) : normalizeCoreOutcome(c.coreOutcome),
      dialOutcome: c.dialOutcome || null,
      durationSeconds: c.durationSeconds,
      transcriptText: includeTranscript ? c.transcriptText || "" : "",
      audioUrl: c.audioUrl || undefined,
      status: c.status as any,
      createdAt: c.createdAt,
      evaluation: ev
        ? hydrateEvaluation(ev, {
            repName,
            callStage: c.callStage,
            coreOutcome: isDialOutcome(c.dialOutcome) ? dialOutcomeLabel(c.dialOutcome) : normalizeCoreOutcome(c.coreOutcome),
            transcriptText: includeTranscript ? c.transcriptText : undefined,
            durationSeconds: c.durationSeconds,
          })
        : undefined,
    });
  }

  return result;
}

export async function getCallById(id: string): Promise<Call | null> {
  const c = await db.select().from(calls).where(and(eq(calls.id, id), forTenant(calls.orgId))).get();
  if (!c) return null;

  const [rep, evalRows] = await Promise.all([
    db.select().from(reps).where(and(eq(reps.id, c.repId), forTenant(reps.orgId))).get(),
    db.select().from(evaluations).where(and(eq(evaluations.callId, c.id), forTenant(evaluations.orgId))).all(),
  ]);
  const ev = latestEvaluationRow(evalRows, c.id);

  let evaluation: CallEvaluation | undefined = undefined;
  if (ev) {
    evaluation = hydrateEvaluation(ev, {
      repName: rep?.name || "Unknown Rep",
      callStage: c.callStage,
      coreOutcome: normalizeCoreOutcome(c.coreOutcome),
      transcriptText: c.transcriptText,
      durationSeconds: c.durationSeconds,
    });
  }

  return {
    id: c.id,
    repId: c.repId,
    repName: rep?.name || "Unknown Rep",
    prospectCompany: c.prospectCompany,
    prospectName: c.prospectName,
    callStage: c.callStage as any,
    coreOutcome: isDialOutcome(c.dialOutcome) ? dialOutcomeLabel(c.dialOutcome) : normalizeCoreOutcome(c.coreOutcome),
    dialOutcome: c.dialOutcome || null,
    durationSeconds: c.durationSeconds,
    transcriptText: c.transcriptText,
    audioUrl: c.audioUrl || undefined,
    status: c.status as any,
    createdAt: c.createdAt,
    evaluation,
  };
}

export async function getDashboardSnapshot(): Promise<{ report: SuperAdminReport; calls: Call[]; reps: Rep[] }> {
  const [allReps, allCalls] = await Promise.all([getAllReps(), getCallSummaries()]);
  return { report: await buildSuperAdminReport(allReps, allCalls), calls: allCalls, reps: allReps };
}

export async function getSuperAdminReport(): Promise<SuperAdminReport> {
  const { report } = await getDashboardSnapshot();
  return report;
}

async function buildSuperAdminReport(allReps: Rep[], allCalls: Call[]): Promise<SuperAdminReport> {
  const completedCalls = allCalls.filter((c) => c.evaluation);

  const totalCalls = completedCalls.length;
  let totalPainPass = 0;
  let totalBudgetPass = 0;
  let totalDecisionPass = 0;
  let totalScriptScore = 0;

  completedCalls.forEach((c) => {
    if (c.evaluation?.sandlerBreakdown.pain.status === "Pass") totalPainPass++;
    if (c.evaluation?.sandlerBreakdown.budget.status === "Pass") totalBudgetPass++;
    if (c.evaluation?.sandlerBreakdown.decision.status === "Pass") totalDecisionPass++;
    totalScriptScore += c.evaluation?.sandlerBreakdown.scriptAdherence.score || 0;
  });

  const snapshots = await db.select().from(repSnapshots).where(forTenant(repSnapshots.orgId)).all();
  const snapshotByRep = new Map(snapshots.map((row: { repId: string }) => [row.repId, row]));
  const repTrajectories = allReps.map((r) => {
    const snapshot = snapshotByRep.get(r.id) as
      | {
          overallTrajectory?: string;
          managerRationale?: string;
          topActiveStruggle?: string;
          recentScriptScore?: number;
        }
      | undefined;
    return {
      repId: r.id,
      repName: r.name,
      trajectory: (snapshot?.overallTrajectory as RepTrajectory) || r.trajectory || "stagnant",
      managerRationale: snapshot?.managerRationale || r.trajectoryReason || "No historical delta yet.",
      topActiveStruggle: snapshot?.topActiveStruggle || "Handling early brush-offs",
      recentScriptScore: snapshot?.recentScriptScore || r.avgScriptScore || 5,
      callsCount: r.totalCalls || 0,
    };
  });

  const methodology = methodById(await getSalesMethodId());
  const pillarByKey = Object.fromEntries(methodology.pillars.map((pillar) => [pillar.key, pillar]));
  // Systemic leaks are derived from real qualification miss-rates, not hardcoded.
  const teamLeaks: SuperAdminReport["systemicTeamLeaks"] = [];
  if (totalCalls > 0) {
    const dims = [
      { key: pillarByKey.pain?.label || "Pain", miss: totalCalls - totalPainPass, directive: pillarByKey.pain?.leakDirective || "" },
      { key: pillarByKey.budget?.label || "Budget", miss: totalCalls - totalBudgetPass, directive: pillarByKey.budget?.leakDirective || "" },
      { key: pillarByKey.decision?.label || "Decision", miss: totalCalls - totalDecisionPass, directive: pillarByKey.decision?.leakDirective || "" },
    ];
    dims
      .filter((d) => d.miss / totalCalls >= 0.4)
      .sort((a, b) => b.miss - a.miss)
      .forEach((d) => {
        teamLeaks.push({
          title: `${d.key} qualification frequently missed`,
          description: `${d.key} was not fully qualified (Incomplete or Fail) on ${d.miss} of ${totalCalls} reviewed call(s).`,
          frequency: `${Math.round((d.miss / totalCalls) * 100)}% of reviewed calls`,
          actionableTeamDirective: d.directive,
        });
      });
  }

  return {
    generatedAt: new Date().toISOString(),
    totalCallsReviewed: totalCalls,
    totalReps: allReps.length,
    teamSandlerRates: {
      painPassRate: totalCalls ? Math.round((totalPainPass / totalCalls) * 100) : 0,
      budgetPassRate: totalCalls ? Math.round((totalBudgetPass / totalCalls) * 100) : 0,
      decisionPassRate: totalCalls ? Math.round((totalDecisionPass / totalCalls) * 100) : 0,
      avgScriptAdherence: totalCalls ? Math.round((totalScriptScore / totalCalls) * 10) / 10 : 0,
    },
    repTrajectories,
    systemicTeamLeaks: teamLeaks,
  };
}

export async function getExecutiveAnalytics(): Promise<ExecutiveAnalytics> {
  const [allCalls, allReps] = await Promise.all([getCallSummaries(), getAllReps()]);

  let booked = 0;
  let demoAgreed = 0;
  let dropped = 0;
  let unqualified = 0;
  let rescheduled = 0;
  let totalDuration = 0;

  const painCounts = { pass: 0, incomplete: 0, fail: 0 };
  const budgetCounts = { pass: 0, incomplete: 0, fail: 0 };
  const decisionCounts = { pass: 0, incomplete: 0, fail: 0 };

  // Objections are aggregated from real flagged missed opportunities, not hardcoded.
  const objectionMap: Record<string, { count: number; pivot: string }> = {};

  allCalls.forEach((c) => {
    totalDuration += c.durationSeconds;
    const bucket = tallyOutcomeBucket(c.coreOutcome);
    if (bucket === "booked") booked++;
    else if (bucket === "demoAgreed") demoAgreed++;
    else if (bucket === "dropped") dropped++;
    else if (bucket === "unqualified") unqualified++;
    else if (bucket === "rescheduled") rescheduled++;

    if (c.evaluation) {
      const p = c.evaluation.sandlerBreakdown.pain.status.toLowerCase() as keyof typeof painCounts;
      const b = c.evaluation.sandlerBreakdown.budget.status.toLowerCase() as keyof typeof budgetCounts;
      const d = c.evaluation.sandlerBreakdown.decision.status.toLowerCase() as keyof typeof decisionCounts;

      if (painCounts[p] !== undefined) painCounts[p]++;
      if (budgetCounts[b] !== undefined) budgetCounts[b]++;
      if (decisionCounts[d] !== undefined) decisionCounts[d]++;

      for (const mo of c.evaluation.missedOpportunities || []) {
        const key = (mo.prospectOpening || "").trim();
        if (!key) continue;
        if (!objectionMap[key]) objectionMap[key] = { count: 0, pivot: mo.whatToSayInstead || "" };
        objectionMap[key].count++;
      }
    }
  });

  const dialFacts = await listDialFacts();
  const dialSummary = tallyDialFunnel(dialFacts);
  const repLeaderboard = allReps.map((r) => {
    return {
      repId: r.id,
      repName: r.name,
      role: r.role,
      trajectory: r.trajectory || "stagnant",
      totalCalls: r.funnel?.dials || 0,
      meetingsBooked: r.funnel?.meetings || 0,
      bookedRate: Math.round(r.closeRate || 0),
      connectRate: r.connectRate || 0,
      closeRate: r.closeRate || 0,
      closePerConnect: r.closePerConnect || 0,
      avgScriptScore: r.avgScriptScore || 0,
      painPassRate: r.painPassRate || 0,
      budgetPassRate: r.budgetPassRate || 0,
      earlyFolds: r.earlyFoldCount || 0,
    };
  }).sort((a, b) => b.closeRate - a.closeRate || b.connectRate - a.connectRate || b.avgScriptScore - a.avgScriptScore);

  const methodology = methodById(await getSalesMethodId());
  const cookbookFunnel = tallyCookbookFunnel(allCalls.map((call) => ({
    callStage: call.callStage,
    coreOutcome: call.coreOutcome,
    durationSeconds: call.durationSeconds,
    painQualified: call.evaluation?.sandlerBreakdown.pain.status === "Pass",
  })));

  const totalSurrenders = Object.values(objectionMap).reduce((acc, cur) => acc + cur.count, 0) || 1;
  const topObjections = Object.entries(objectionMap).map(([objection, data]) => ({
    objection,
    surrenderCount: data.count,
    percentage: Math.round((data.count / totalSurrenders) * 100),
    recommendedPivot: data.pivot,
  })).sort((a, b) => b.surrenderCount - a.surrenderCount).slice(0, 5);

  return {
    totalCalls: dialSummary.dials,
    winRate: Math.round(dialSummary.closeRate),
    connectRate: dialSummary.connectRate,
    closeRate: dialSummary.closeRate,
    closePerConnect: dialSummary.closePerConnect,
    avgCallDuration: allCalls.length ? Math.round(totalDuration / allCalls.length) : 0,
    outcomesBreakdown: {
      booked,
      demoAgreed,
      dropped,
      unqualified,
      rescheduled,
    },
    sandlerDistribution: {
      pain: painCounts,
      budget: budgetCounts,
      decision: decisionCounts,
    },
    methodologyName: methodology.name,
    pillarLabels: {
      pain: methodology.pillars.find((pillar) => pillar.key === "pain")?.label || "Pain",
      budget: methodology.pillars.find((pillar) => pillar.key === "budget")?.label || "Budget",
      decision: methodology.pillars.find((pillar) => pillar.key === "decision")?.label || "Decision",
    },
    cookbookFunnel,
    dialFunnel: dialSummary.steps,
    dialOutcomeCounts: dialSummary.outcomes,
    topObjectionsCausingSurrender: topObjections,
    repLeaderboard,
  };
}

export async function insertCall(values: {
  id: string;
  repId: string;
  prospectCompany: string;
  prospectName: string;
  callStage: string;
  coreOutcome: string;
  durationSeconds: number;
  transcriptText: string;
  audioUrl?: string;
  status: string;
  createdAt: string;
}): Promise<void> {
  await db.insert(calls).values({
    ...values,
    orgId: tenantId(),
  }).run();
  const { autoApplyScorecardsForCall } = await import("../scorecards");
  await autoApplyScorecardsForCall(values.id);
}

export async function updateCallStatus(
  id: string,
  status: "completed" | "failed" | "analyzing",
  coreOutcome?: string,
  expectedStatus?: "completed" | "failed" | "analyzing"
): Promise<void> {
  const patch: Record<string, any> = { status };
  if (coreOutcome !== undefined) patch.coreOutcome = coreOutcome;
  await db
    .update(calls)
    .set(patch)
    .where(and(eq(calls.id, id), forTenant(calls.orgId), expectedStatus ? eq(calls.status, expectedStatus) : undefined))
    .run();
}

const BACKFILL_KEY = "tenant_backfill_org_id";

async function copyUnprefixedSettingsToTenant(org: string): Promise<void> {
  const rows = await db.select().from(appSettings).all();
  for (const row of rows as { key: string; value: string }[]) {
    if (isGlobalSettingKey(row.key) || row.key.startsWith("t:")) continue;
    let logicalKey = row.key;
    if (logicalKey.startsWith(`billing:${org}:`)) {
      logicalKey = `billing:${logicalKey.slice(`billing:${org}:`.length)}`;
    } else if (logicalKey.startsWith("billing:workspace:")) {
      logicalKey = `billing:${logicalKey.slice("billing:workspace:".length)}`;
    }
    const targetKey = settingStorageKey(org, logicalKey);
    const exists = await readRawSetting(targetKey);
    if (exists == null) {
      await writeRawSetting(targetKey, openSetting(row.key, row.value));
    }
  }
}

/**
 * Existing unscoped rows (pre-isolation) are stamped `local`. Assign them once
 * to the explicitly configured LEGACY_TENANT_ORG_ID so the original customer
 * keeps their data and new orgs start empty.
 */
export async function backfillLegacyTenant(oldestOrgId?: string | null): Promise<string | null> {
  const already = await readRawSetting(BACKFILL_KEY);
  if (already) return already === "none" ? null : already;

  const target = (process.env.LEGACY_TENANT_ORG_ID || oldestOrgId || "").trim();
  if (!target || target === LOCAL_TENANT_ID) {
    return null;
  }

  try {
    await db.update(reps).set({ orgId: target }).where(eq(reps.orgId, LOCAL_TENANT_ID)).run();
    await db.update(calls).set({ orgId: target }).where(eq(calls.orgId, LOCAL_TENANT_ID)).run();
    await db.update(evaluations).set({ orgId: target }).where(eq(evaluations.orgId, LOCAL_TENANT_ID)).run();
    await db.update(repSnapshots).set({ orgId: target }).where(eq(repSnapshots.orgId, LOCAL_TENANT_ID)).run();
    await db.update(scripts).set({ orgId: target }).where(eq(scripts.orgId, LOCAL_TENANT_ID)).run();
    await db.update(repPersonas).set({ orgId: target }).where(eq(repPersonas.orgId, LOCAL_TENANT_ID)).run();
  } catch (err) {
    console.warn("Legacy tenant backfill skipped:");
    return null;
  }

  await copyUnprefixedSettingsToTenant(target);
  const billed = await readRawSetting(settingStorageKey(target, "billing:plan"));
  if (!billed) {
    await writeRawSetting(settingStorageKey(target, "billing:plan"), "coach");
  }
  await writeRawSetting(BACKFILL_KEY, target);
  return target;
}

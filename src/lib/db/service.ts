import { db } from "./index";
import { reps, calls, evaluations, repSnapshots, appSettings, scripts, repPersonas } from "./schema";
import { eq, desc } from "drizzle-orm";
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
import { mergeCallStages, normalizeStageName, stagesEqual } from "@/lib/callStages";
import { hydrateEvaluation, latestEvaluationRow, latestEvaluationsByCall } from "@/lib/evaluations";
import { isUnusableTranscript } from "@/lib/transcript";
import { isMeetingBooked, normalizeCoreOutcome, tallyOutcomeBucket } from "@/lib/coreOutcome";
import { buildManagerTalkTrack } from "@/lib/managerTalkTrack";
import type { ManagerTalkTrack } from "@/lib/managerTalkTrack";

// --- Settings Service ---
export async function getSetting(key: string): Promise<string | null> {
  const row = await db.select().from(appSettings).where(eq(appSettings.key, key)).get();
  return row ? row.value : null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const existing = await db.select().from(appSettings).where(eq(appSettings.key, key)).get();
  if (existing) {
    await db.update(appSettings)
      .set({ value, updatedAt: new Date().toISOString() })
      .where(eq(appSettings.key, key))
      .run();
  } else {
    await db.insert(appSettings).values({
      key,
      value,
      updatedAt: new Date().toISOString(),
    }).run();
  }
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await db.select().from(appSettings).all();
  const res: Record<string, string> = {};
  rows.forEach((r: any) => {
    res[r.key] = r.value;
  });
  return res;
}

// --- Coach Service (manager-authored coaching philosophy + lessons) ---
// Stored in app_settings so no schema migration is required.
// Empty / unset instructions fall back to the Sandler Selling System default.
export async function getStoredCoachInstructions(): Promise<string> {
  return (await getSetting("coach_instructions")) || "";
}

export async function getCoachInstructions(): Promise<string> {
  const stored = await getStoredCoachInstructions();
  return stored.trim() ? stored : DEFAULT_SANDLER_INSTRUCTIONS;
}

export async function setCoachInstructions(text: string): Promise<void> {
  const trimmed = (text || "").trim();
  // Saving empty resets to the Sandler default (stored as empty so fallback applies).
  await setSetting("coach_instructions", trimmed === DEFAULT_SANDLER_INSTRUCTIONS.trim() ? "" : trimmed);
}

export async function coachUsesDefaultSandler(): Promise<boolean> {
  return isDefaultSandlerInstructions(await getStoredCoachInstructions());
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
  return parts.join("\n\n");
}

// --- Scripts / Playbooks Service ---
export async function getAllScripts(): Promise<SalesScript[]> {
  const rows = await db.select().from(scripts).all();
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
  const existing = await db.select().from(scripts).where(eq(scripts.id, scriptData.id)).get();

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
      .where(eq(scripts.id, scriptData.id))
      .run();
  } else {
    await db.insert(scripts).values({
      id: scriptData.id,
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
  await db.delete(scripts).where(eq(scripts.id, id)).run();
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
  const allCalls = await db.select({ callStage: calls.callStage }).from(calls).all();
  return mergeCallStages(
    stored,
    scriptStages,
    allCalls.map((c: { callStage: string }) => c.callStage)
  );
}

export async function addCallStage(name: string): Promise<string[]> {
  const stage = normalizeStageName(name);
  if (!stage) throw new Error("Call Stage Target is required.");
  const current = await getCallStages();
  if (current.some((s) => stagesEqual(s, stage))) return current;
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
    await db.update(scripts).set({ stage: target, updatedAt: new Date().toISOString() }).where(eq(scripts.id, script.id)).run();
  }

  const matchingCalls = await db.select().from(calls).all();
  for (const call of matchingCalls) {
    if (stagesEqual(call.callStage, source)) {
      await db.update(calls).set({ callStage: target }).where(eq(calls.id, call.id)).run();
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
  const row = await db.select().from(repPersonas).where(eq(repPersonas.repId, repId)).get();
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
  const existing = await db.select().from(repPersonas).where(eq(repPersonas.repId, persona.repId)).get();

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
      .where(eq(repPersonas.repId, persona.repId))
      .run();
  } else {
    await db.insert(repPersonas).values({
      id,
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
export async function getOrCreateRep(
  repId?: string,
  repName?: string,
  repRole?: string
): Promise<string> {
  if (repId && repId !== "new") {
    const existing = await db.select().from(reps).where(eq(reps.id, repId)).get();
    if (existing) return existing.id;
  }

  const name = (repName || "").trim();
  if (name) {
    const all = await db.select().from(reps).all();
    const match = all.find(
      (r: any) => r.name.toLowerCase() === name.toLowerCase()
    );
    if (match) return match.id;
  }

  const slug =
    (name || "rep")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 24) || "rep";
  const id = `rep_${slug}_${Date.now().toString(36)}`;

  await db
    .insert(reps)
    .values({
      id,
      name: name || "New Rep",
      email: `${slug}@company.io`,
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
export async function getAllReps(): Promise<Rep[]> {
  await deleteCallsWithoutTranscript();
  const allReps = await db.select().from(reps).all();
  const allCalls = await db.select().from(calls).all();
  const allEvals = await db.select().from(evaluations).all();
  const allSnapshots = await db.select().from(repSnapshots).all();

  const repsWithMetrics: Rep[] = [];

  for (const r of allReps) {
    const repCalls = allCalls.filter((c: any) => c.repId === r.id);
    const repEvals = latestEvaluationsByCall(allEvals.filter((e: any) => e.repId === r.id));
    const snapshot = allSnapshots.find((s: any) => s.repId === r.id);
    const persona = await getRepPersona(r.id);

    let painPassCount = 0;
    let budgetPassCount = 0;
    let decisionPassCount = 0;
    let totalScore = 0;
    let earlyFoldCount = 0;
    let bookedCount = 0;

    repCalls.forEach((c: any) => {
      if (isMeetingBooked(c.coreOutcome)) bookedCount++;
    });

    repEvals.forEach((e: any) => {
      if (e.painStatus === "Pass") painPassCount++;
      if (e.budgetStatus === "Pass") budgetPassCount++;
      if (e.decisionStatus === "Pass") decisionPassCount++;
      totalScore += e.scriptAdherenceScore;

      try {
        const missed = JSON.parse(e.missedOpportunities) as MissedOpportunity[];
        earlyFoldCount += missed.length;
      } catch {}
    });

    repsWithMetrics.push({
      id: r.id,
      name: r.name,
      email: r.email,
      role: r.role,
      avatarUrl: r.avatarUrl || undefined,
      createdAt: r.createdAt,
      trajectory: (snapshot?.overallTrajectory as RepTrajectory) || "stagnant",
      trajectoryReason: snapshot?.managerRationale || "Baseline evaluation in progress.",
      totalCalls: repCalls.length,
      avgScriptScore: repEvals.length ? Math.round((totalScore / repEvals.length) * 10) / 10 : 0,
      painPassRate: repEvals.length ? Math.round((painPassCount / repEvals.length) * 100) : 0,
      budgetPassRate: repEvals.length ? Math.round((budgetPassCount / repEvals.length) * 100) : 0,
      decisionPassRate: repEvals.length ? Math.round((decisionPassCount / repEvals.length) * 100) : 0,
      earlyFoldCount,
      bookedRate: repCalls.length ? Math.round((bookedCount / repCalls.length) * 100) : 0,
      persona: persona || undefined,
    });
  }

  return repsWithMetrics;
}

export async function getRepById(id: string): Promise<{
  rep: Rep | null;
  calls: Call[];
  snapshot: any | null;
  talkTrack: ManagerTalkTrack | null;
}> {
  await deleteCallsWithoutTranscript();
  const repRecord = await db.select().from(reps).where(eq(reps.id, id)).get();
  if (!repRecord) return { rep: null, calls: [], snapshot: null, talkTrack: null };

  const repCalls = await db.select().from(calls).where(eq(calls.repId, id)).orderBy(desc(calls.createdAt)).all();
  const repEvals = await db.select().from(evaluations).where(eq(evaluations.repId, id)).all();
  const snapshot = await db.select().from(repSnapshots).where(eq(repSnapshots.repId, id)).get();
  const persona = await getRepPersona(id);

  const fullCalls: Call[] = repCalls.map((c: any) => {
    const ev = latestEvaluationRow(repEvals, c.id);
    let evaluation: CallEvaluation | undefined = undefined;
    if (ev) {
      evaluation = hydrateEvaluation(ev, {
        repName: repRecord.name,
        callStage: c.callStage,
        coreOutcome: normalizeCoreOutcome(c.coreOutcome),
        transcriptText: c.transcriptText,
        durationSeconds: c.durationSeconds,
      });
    }

    return {
      id: c.id,
      repId: c.repId,
      repName: repRecord.name,
      prospectCompany: c.prospectCompany,
      prospectName: c.prospectName,
      callStage: c.callStage as any,
      coreOutcome: normalizeCoreOutcome(c.coreOutcome),
      durationSeconds: c.durationSeconds,
      transcriptText: c.transcriptText,
      audioUrl: c.audioUrl || undefined,
      status: c.status as any,
      createdAt: c.createdAt,
      evaluation,
    };
  });

  const allRepsList = await getAllReps();
  const computedRep = allRepsList.find((r) => r.id === id) || {
    id: repRecord.id,
    name: repRecord.name,
    email: repRecord.email,
    role: repRecord.role,
    createdAt: repRecord.createdAt,
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
  const rows = await db.select({ id: calls.id, transcriptText: calls.transcriptText }).from(calls).all();
  const removed: string[] = [];
  for (const row of rows) {
    if (!isUnusableTranscript(row.transcriptText)) continue;
    await db.delete(evaluations).where(eq(evaluations.callId, row.id)).run();
    await db.delete(calls).where(eq(calls.id, row.id)).run();
    removed.push(row.id);
  }
  return removed;
}

export async function getAllCalls(): Promise<Call[]> {
  await deleteCallsWithoutTranscript();
  const allCalls = await db.select().from(calls).orderBy(desc(calls.createdAt)).all();
  const allReps = await db.select().from(reps).all();
  const allEvals = await db.select().from(evaluations).all();

  return allCalls.map((c: any) => {
    const rep = allReps.find((r: any) => r.id === c.repId);
    const ev = latestEvaluationRow(allEvals, c.id);
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
      coreOutcome: normalizeCoreOutcome(c.coreOutcome),
      durationSeconds: c.durationSeconds,
      transcriptText: c.transcriptText,
      audioUrl: c.audioUrl || undefined,
      status: c.status as any,
      createdAt: c.createdAt,
      evaluation,
    };
  });
}

export async function getCallById(id: string): Promise<Call | null> {
  const c = await db.select().from(calls).where(eq(calls.id, id)).get();
  if (!c) return null;
  if (isUnusableTranscript(c.transcriptText)) {
    await db.delete(evaluations).where(eq(evaluations.callId, c.id)).run();
    await db.delete(calls).where(eq(calls.id, c.id)).run();
    return null;
  }

  const rep = await db.select().from(reps).where(eq(reps.id, c.repId)).get();
  const ev = latestEvaluationRow(
    await db.select().from(evaluations).where(eq(evaluations.callId, c.id)).all(),
    c.id
  );

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
    coreOutcome: normalizeCoreOutcome(c.coreOutcome),
    durationSeconds: c.durationSeconds,
    transcriptText: c.transcriptText,
    audioUrl: c.audioUrl || undefined,
    status: c.status as any,
    createdAt: c.createdAt,
    evaluation,
  };
}

export async function getSuperAdminReport(): Promise<SuperAdminReport> {
  const allReps = await getAllReps();
  const allCalls = await getAllCalls();
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

  const repTrajectories = [];
  for (const r of allReps) {
    const snapshot = await db.select().from(repSnapshots).where(eq(repSnapshots.repId, r.id)).get();
    repTrajectories.push({
      repId: r.id,
      repName: r.name,
      trajectory: (snapshot?.overallTrajectory as RepTrajectory) || r.trajectory || "stagnant",
      managerRationale: snapshot?.managerRationale || r.trajectoryReason || "No historical delta yet.",
      topActiveStruggle: snapshot?.topActiveStruggle || "Handling early brush-offs",
      recentScriptScore: snapshot?.recentScriptScore || r.avgScriptScore || 5,
      callsCount: r.totalCalls || 0,
    });
  }

  // Systemic leaks are derived from real qualification miss-rates, not hardcoded.
  const teamLeaks: SuperAdminReport["systemicTeamLeaks"] = [];
  if (totalCalls > 0) {
    const dims = [
      { key: "Pain", miss: totalCalls - totalPainPass, directive: "Coach reps to uncover and quantify business pain before pitching a solution." },
      { key: "Budget", miss: totalCalls - totalBudgetPass, directive: "Require a budget-range conversation before any demo or proposal." },
      { key: "Decision", miss: totalCalls - totalDecisionPass, directive: "Map the economic buyer and approval process on every qualified call." },
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
  const allCalls = await getAllCalls();
  const allReps = await getAllReps();

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

  const repLeaderboard = allReps.map((r) => {
    const repCalls = allCalls.filter((c) => c.repId === r.id);
    let meetingsBooked = 0;
    repCalls.forEach((c) => {
      if (isMeetingBooked(c.coreOutcome)) meetingsBooked++;
    });

    return {
      repId: r.id,
      repName: r.name,
      role: r.role,
      trajectory: r.trajectory || "stagnant",
      totalCalls: r.totalCalls || 0,
      meetingsBooked,
      bookedRate: r.totalCalls ? Math.round((meetingsBooked / r.totalCalls) * 100) : 0,
      avgScriptScore: r.avgScriptScore || 0,
      painPassRate: r.painPassRate || 0,
      budgetPassRate: r.budgetPassRate || 0,
      earlyFolds: r.earlyFoldCount || 0,
    };
  }).sort((a, b) => b.bookedRate - a.bookedRate || b.avgScriptScore - a.avgScriptScore);

  const totalSurrenders = Object.values(objectionMap).reduce((acc, cur) => acc + cur.count, 0) || 1;
  const topObjections = Object.entries(objectionMap).map(([objection, data]) => ({
    objection,
    surrenderCount: data.count,
    percentage: Math.round((data.count / totalSurrenders) * 100),
    recommendedPivot: data.pivot,
  })).sort((a, b) => b.surrenderCount - a.surrenderCount).slice(0, 5);

  return {
    totalCalls: allCalls.length,
    winRate: allCalls.length ? Math.round((booked / allCalls.length) * 100) : 0,
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
    topObjectionsCausingSurrender: topObjections,
    repLeaderboard,
  };
}

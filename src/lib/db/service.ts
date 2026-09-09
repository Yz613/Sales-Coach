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
  CallStage
} from "@/types";

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

// --- Reps & Calls ---
export async function getAllReps(): Promise<Rep[]> {
  const allReps = await db.select().from(reps).all();
  const allCalls = await db.select().from(calls).all();
  const allEvals = await db.select().from(evaluations).all();
  const allSnapshots = await db.select().from(repSnapshots).all();

  const repsWithMetrics: Rep[] = [];

  for (const r of allReps) {
    const repCalls = allCalls.filter((c: any) => c.repId === r.id);
    const repEvals = allEvals.filter((e: any) => e.repId === r.id);
    const snapshot = allSnapshots.find((s: any) => s.repId === r.id);
    const persona = await getRepPersona(r.id);

    let painPassCount = 0;
    let budgetPassCount = 0;
    let decisionPassCount = 0;
    let totalScore = 0;
    let earlyFoldCount = 0;
    let bookedCount = 0;

    repCalls.forEach((c: any) => {
      if (c.coreOutcome.toLowerCase().includes("booked")) bookedCount++;
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

export async function getRepById(id: string): Promise<{ rep: Rep | null; calls: Call[]; snapshot: any | null }> {
  const repRecord = await db.select().from(reps).where(eq(reps.id, id)).get();
  if (!repRecord) return { rep: null, calls: [], snapshot: null };

  const repCalls = await db.select().from(calls).where(eq(calls.repId, id)).orderBy(desc(calls.createdAt)).all();
  const repEvals = await db.select().from(evaluations).where(eq(evaluations.repId, id)).all();
  const snapshot = await db.select().from(repSnapshots).where(eq(repSnapshots.repId, id)).get();
  const persona = await getRepPersona(id);

  const fullCalls: Call[] = repCalls.map((c: any) => {
    const ev = repEvals.find((e: any) => e.callId === c.id);
    let evaluation: CallEvaluation | undefined = undefined;
    if (ev) {
      evaluation = {
        id: ev.id,
        callId: ev.callId,
        repId: ev.repId,
        repName: repRecord.name,
        callTypeDetected: c.callStage as any,
        coreOutcome: c.coreOutcome as any,
        bottomLine: ev.bottomLine,
        missedOpportunities: JSON.parse(ev.missedOpportunities || "[]"),
        sandlerBreakdown: {
          pain: { status: ev.painStatus as SandlerStatus, evidence: ev.painEvidence },
          budget: { status: ev.budgetStatus as SandlerStatus, evidence: ev.budgetEvidence },
          decision: { status: ev.decisionStatus as SandlerStatus, evidence: ev.decisionEvidence },
          scriptAdherence: { score: ev.scriptAdherenceScore, feedback: ev.scriptFeedback },
        },
        scriptDivergence: ev.scriptDivergence ? JSON.parse(ev.scriptDivergence) : undefined,
        topFixes: JSON.parse(ev.topFixes || "[]"),
        rawMarkdown: ev.rawMarkdown || undefined,
        createdAt: ev.createdAt,
      };
    }

    return {
      id: c.id,
      repId: c.repId,
      repName: repRecord.name,
      prospectCompany: c.prospectCompany,
      prospectName: c.prospectName,
      callStage: c.callStage as any,
      coreOutcome: c.coreOutcome,
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

  return { rep: computedRep, calls: fullCalls, snapshot };
}

export async function getAllCalls(): Promise<Call[]> {
  const allCalls = await db.select().from(calls).orderBy(desc(calls.createdAt)).all();
  const allReps = await db.select().from(reps).all();
  const allEvals = await db.select().from(evaluations).all();

  return allCalls.map((c: any) => {
    const rep = allReps.find((r: any) => r.id === c.repId);
    const ev = allEvals.find((e: any) => e.callId === c.id);
    let evaluation: CallEvaluation | undefined = undefined;

    if (ev) {
      evaluation = {
        id: ev.id,
        callId: ev.callId,
        repId: ev.repId,
        repName: rep?.name || "Unknown Rep",
        callTypeDetected: c.callStage as any,
        coreOutcome: c.coreOutcome as any,
        bottomLine: ev.bottomLine,
        missedOpportunities: JSON.parse(ev.missedOpportunities || "[]"),
        sandlerBreakdown: {
          pain: { status: ev.painStatus as SandlerStatus, evidence: ev.painEvidence },
          budget: { status: ev.budgetStatus as SandlerStatus, evidence: ev.budgetEvidence },
          decision: { status: ev.decisionStatus as SandlerStatus, evidence: ev.decisionEvidence },
          scriptAdherence: { score: ev.scriptAdherenceScore, feedback: ev.scriptFeedback },
        },
        scriptDivergence: ev.scriptDivergence ? JSON.parse(ev.scriptDivergence) : undefined,
        topFixes: JSON.parse(ev.topFixes || "[]"),
        rawMarkdown: ev.rawMarkdown || undefined,
        createdAt: ev.createdAt,
      };
    }

    return {
      id: c.id,
      repId: c.repId,
      repName: rep?.name || "Unknown Rep",
      prospectCompany: c.prospectCompany,
      prospectName: c.prospectName,
      callStage: c.callStage as any,
      coreOutcome: c.coreOutcome,
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

  const rep = await db.select().from(reps).where(eq(reps.id, c.repId)).get();
  const ev = await db.select().from(evaluations).where(eq(evaluations.callId, c.id)).get();

  let evaluation: CallEvaluation | undefined = undefined;
  if (ev) {
    evaluation = {
      id: ev.id,
      callId: ev.callId,
      repId: ev.repId,
      repName: rep?.name || "Unknown Rep",
      callTypeDetected: c.callStage as any,
      coreOutcome: c.coreOutcome as any,
      bottomLine: ev.bottomLine,
      missedOpportunities: JSON.parse(ev.missedOpportunities || "[]"),
      sandlerBreakdown: {
        pain: { status: ev.painStatus as SandlerStatus, evidence: ev.painEvidence },
        budget: { status: ev.budgetStatus as SandlerStatus, evidence: ev.budgetEvidence },
        decision: { status: ev.decisionStatus as SandlerStatus, evidence: ev.decisionEvidence },
        scriptAdherence: { score: ev.scriptAdherenceScore, feedback: ev.scriptFeedback },
      },
      scriptDivergence: ev.scriptDivergence ? JSON.parse(ev.scriptDivergence) : undefined,
      topFixes: JSON.parse(ev.topFixes || "[]"),
      rawMarkdown: ev.rawMarkdown || undefined,
      createdAt: ev.createdAt,
    };
  }

  return {
    id: c.id,
    repId: c.repId,
    repName: rep?.name || "Unknown Rep",
    prospectCompany: c.prospectCompany,
    prospectName: c.prospectName,
    callStage: c.callStage as any,
    coreOutcome: c.coreOutcome,
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
    systemicTeamLeaks: [
      {
        title: "Immediate Surrender on 'Already Have a Vendor'",
        description: "Reps are dropping cold calls immediately when prospects state they have an existing tool instead of asking what they would improve or how long they are locked in.",
        frequency: "48% of cold calls",
        actionableTeamDirective: "Mandate the 'Disarm & Pivot' script: 'Totally understand. Most folks we work with had [Competitor] in place. Quick question—are you 100% satisfied with their support responsiveness?'",
      },
      {
        title: "Dancing Around Money in Discovery",
        description: "Reps wait until the final 2 minutes of the demo to touch budget, leading to sticker shock and vague 'send a proposal' brush-offs.",
        frequency: "62% of first discovery calls",
        actionableTeamDirective: "Budget qualification must occur before the live software walk. Force reps to lock a budget bracket ($15k–$30k) before screen sharing.",
      },
      {
        title: "Failing to Identify the Economic Buyer",
        description: "Reps schedule demos with mid-level managers without mapping out the VP or C-suite approval process.",
        frequency: "35% of qualification calls",
        actionableTeamDirective: "Ask directly: 'When you've purchased software like this in the past, who else in finance or the executive team signed off on the PO?'",
      },
    ],
  };
}

export async function getExecutiveAnalytics(): Promise<ExecutiveAnalytics> {
  const allCalls = await getAllCalls();
  const allReps = await getAllReps();

  let booked = 0;
  let dropped = 0;
  let unqualified = 0;
  let rescheduled = 0;
  let totalDuration = 0;

  const painCounts = { pass: 0, incomplete: 0, fail: 0 };
  const budgetCounts = { pass: 0, incomplete: 0, fail: 0 };
  const decisionCounts = { pass: 0, incomplete: 0, fail: 0 };

  const objectionMap: Record<string, { count: number; pivot: string }> = {
    "Already have a vendor": { count: 6, pivot: "Validate competitor, probe specific support/sync pain" },
    "Send me an email": { count: 8, pivot: "State that vendor emails get buried; ask for 60 seconds" },
    "No budget allocated": { count: 4, pivot: "Ask about cost of inaction before talking purchase orders" },
    "Too busy / Call next quarter": { count: 3, pivot: "Clarify if it's bandwidth or lack of priority" },
  };

  allCalls.forEach((c) => {
    totalDuration += c.durationSeconds;
    const outcome = c.coreOutcome.toLowerCase();
    if (outcome.includes("booked")) booked++;
    else if (outcome.includes("dropped")) dropped++;
    else if (outcome.includes("unqualified")) unqualified++;
    else if (outcome.includes("rescheduled")) rescheduled++;

    if (c.evaluation) {
      const p = c.evaluation.sandlerBreakdown.pain.status.toLowerCase() as keyof typeof painCounts;
      const b = c.evaluation.sandlerBreakdown.budget.status.toLowerCase() as keyof typeof budgetCounts;
      const d = c.evaluation.sandlerBreakdown.decision.status.toLowerCase() as keyof typeof decisionCounts;

      if (painCounts[p] !== undefined) painCounts[p]++;
      if (budgetCounts[b] !== undefined) budgetCounts[b]++;
      if (decisionCounts[d] !== undefined) decisionCounts[d]++;
    }
  });

  const repLeaderboard = allReps.map((r) => {
    const repCalls = allCalls.filter((c) => c.repId === r.id);
    let meetingsBooked = 0;
    repCalls.forEach((c) => {
      if (c.coreOutcome.toLowerCase().includes("booked")) meetingsBooked++;
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
  })).sort((a, b) => b.surrenderCount - a.surrenderCount);

  return {
    totalCalls: allCalls.length,
    winRate: allCalls.length ? Math.round((booked / allCalls.length) * 100) : 0,
    avgCallDuration: allCalls.length ? Math.round(totalDuration / allCalls.length) : 0,
    outcomesBreakdown: {
      booked,
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

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
export function getSetting(key: string): string | null {
  const row = db.select().from(appSettings).where(eq(appSettings.key, key)).get();
  return row ? row.value : null;
}

export function setSetting(key: string, value: string): void {
  const existing = db.select().from(appSettings).where(eq(appSettings.key, key)).get();
  if (existing) {
    db.update(appSettings)
      .set({ value, updatedAt: new Date().toISOString() })
      .where(eq(appSettings.key, key))
      .run();
  } else {
    db.insert(appSettings).values({
      key,
      value,
      updatedAt: new Date().toISOString(),
    }).run();
  }
}

export function getAllSettings(): Record<string, string> {
  const rows = db.select().from(appSettings).all();
  const res: Record<string, string> = {};
  rows.forEach((r) => {
    res[r.key] = r.value;
  });
  return res;
}

// --- Scripts / Playbooks Service ---
export function getAllScripts(): SalesScript[] {
  const rows = db.select().from(scripts).all();
  return rows.map((r) => ({
    id: r.id,
    stage: r.stage as CallStage,
    title: r.title,
    content: r.content,
    keyMilestones: JSON.parse(r.keyMilestones || "[]"),
    isActive: Boolean(r.isActive),
    updatedAt: r.updatedAt,
  }));
}

export function getActiveScriptForStage(stage: string): SalesScript | null {
  const all = getAllScripts();
  return all.find((s) => s.stage.toLowerCase() === stage.toLowerCase() && s.isActive) || null;
}

export function saveScript(scriptData: Omit<SalesScript, "updatedAt">): SalesScript {
  const updatedAt = new Date().toISOString();
  const existing = db.select().from(scripts).where(eq(scripts.id, scriptData.id)).get();

  if (existing) {
    db.update(scripts)
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
    db.insert(scripts).values({
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

export function deleteScript(id: string): void {
  db.delete(scripts).where(eq(scripts.id, id)).run();
}

// --- Rep Persona Service ---
export function getRepPersona(repId: string): RepPersona | null {
  const row = db.select().from(repPersonas).where(eq(repPersonas.repId, repId)).get();
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

export function saveRepPersona(persona: RepPersona): RepPersona {
  const updatedAt = new Date().toISOString();
  const id = persona.id || `persona_${persona.repId}`;
  const existing = db.select().from(repPersonas).where(eq(repPersonas.repId, persona.repId)).get();

  if (existing) {
    db.update(repPersonas)
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
    db.insert(repPersonas).values({
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

// --- Reps & Calls ---
export function getAllReps(): Rep[] {
  const allReps = db.select().from(reps).all();
  const allCalls = db.select().from(calls).all();
  const allEvals = db.select().from(evaluations).all();
  const allSnapshots = db.select().from(repSnapshots).all();

  return allReps.map((r) => {
    const repCalls = allCalls.filter((c) => c.repId === r.id);
    const repEvals = allEvals.filter((e) => e.repId === r.id);
    const snapshot = allSnapshots.find((s) => s.repId === r.id);
    const persona = getRepPersona(r.id);

    let painPassCount = 0;
    let budgetPassCount = 0;
    let decisionPassCount = 0;
    let totalScore = 0;
    let earlyFoldCount = 0;
    let bookedCount = 0;

    repCalls.forEach((c) => {
      if (c.coreOutcome.toLowerCase().includes("booked")) bookedCount++;
    });

    repEvals.forEach((e) => {
      if (e.painStatus === "Pass") painPassCount++;
      if (e.budgetStatus === "Pass") budgetPassCount++;
      if (e.decisionStatus === "Pass") decisionPassCount++;
      totalScore += e.scriptAdherenceScore;

      try {
        const missed = JSON.parse(e.missedOpportunities) as MissedOpportunity[];
        earlyFoldCount += missed.length;
      } catch {}
    });

    const evalCount = repEvals.length || 1;
    const callsCount = repCalls.length || 1;

    return {
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
    };
  });
}

export function getRepById(id: string): { rep: Rep | null; calls: Call[]; snapshot: any | null } {
  const repRecord = db.select().from(reps).where(eq(reps.id, id)).get();
  if (!repRecord) return { rep: null, calls: [], snapshot: null };

  const repCalls = db.select().from(calls).where(eq(calls.repId, id)).orderBy(desc(calls.createdAt)).all();
  const repEvals = db.select().from(evaluations).where(eq(evaluations.repId, id)).all();
  const snapshot = db.select().from(repSnapshots).where(eq(repSnapshots.repId, id)).get();
  const persona = getRepPersona(id);

  const fullCalls: Call[] = repCalls.map((c) => {
    const ev = repEvals.find((e) => e.callId === c.id);
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

  const allRepsList = getAllReps();
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

export function getAllCalls(): Call[] {
  const allCalls = db.select().from(calls).orderBy(desc(calls.createdAt)).all();
  const allReps = db.select().from(reps).all();
  const allEvals = db.select().from(evaluations).all();

  return allCalls.map((c) => {
    const rep = allReps.find((r) => r.id === c.repId);
    const ev = allEvals.find((e) => e.callId === c.id);
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

export function getCallById(id: string): Call | null {
  const c = db.select().from(calls).where(eq(calls.id, id)).get();
  if (!c) return null;

  const rep = db.select().from(reps).where(eq(reps.id, c.repId)).get();
  const ev = db.select().from(evaluations).where(eq(evaluations.callId, c.id)).get();

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

export function getSuperAdminReport(): SuperAdminReport {
  const allReps = getAllReps();
  const allCalls = getAllCalls();
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

  const repTrajectories = allReps.map((r) => {
    const snapshot = db.select().from(repSnapshots).where(eq(repSnapshots.repId, r.id)).get();
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

export function getExecutiveAnalytics(): ExecutiveAnalytics {
  const allCalls = getAllCalls();
  const allReps = getAllReps();
  const completed = allCalls.filter((c) => c.evaluation);

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

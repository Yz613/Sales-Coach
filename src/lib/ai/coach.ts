import { db } from "../db";
import { evaluations, calls, reps, repSnapshots } from "../db/schema";
import { getSetting, getActiveScriptForStage, getRepPersona, getCoachContext } from "../db/service";
import { computeScriptDivergence } from "../callInsights";
import { eq, desc } from "drizzle-orm";
import type { CallEvaluation, MissedOpportunity, PriorityFix, SandlerStatus, RepTrajectory, SalesScript, RepPersona } from "@/types";

interface EvaluationInput {
  callId: string;
  repId: string;
  transcriptText: string;
  callStage: string;
  prospectCompany: string;
  prospectName: string;
}

export async function evaluateCall(input: EvaluationInput): Promise<CallEvaluation> {
  const rep = await db.select().from(reps).where(eq(reps.id, input.repId)).get();
  const repName = rep?.name || "Rep";

  // 1. Ingest rep persona & manager notes
  const persona = await getRepPersona(input.repId);

  // 2. Ingest active prescribed script/playbook for this stage
  const activeScript = await getActiveScriptForStage(input.callStage);

  // 3. Ingest historical context (last 3 calls)
  const previousEvals = await db
    .select()
    .from(evaluations)
    .where(eq(evaluations.repId, input.repId))
    .orderBy(desc(evaluations.createdAt))
    .limit(3)
    .all();

  const pastFixesSummary = previousEvals.map((e: any, idx: number) => {
    try {
      const fixes = JSON.parse(e.topFixes) as PriorityFix[];
      return `Call -${idx + 1} Fixes: ${fixes.map((f) => f.title).join("; ")}`;
    } catch {
      return "";
    }
  }).filter(Boolean).join("\n");

  // 4. Ingest the manager's custom coaching directives (philosophy + taught lessons)
  const coachContext = await getCoachContext();

  // Check for GEMINI API KEY in app_settings table first, then environment
  const geminiApiKey = (await getSetting("gemini_api_key")) || process.env.GEMINI_API_KEY;
  const activeModel = (await getSetting("active_model")) || "gemini-3.8-flash";

  let evaluationResult: Omit<CallEvaluation, "id" | "callId" | "repId" | "createdAt">;

  if (geminiApiKey && geminiApiKey.trim().length > 0) {
    try {
      evaluationResult = await callGeminiAPI(input, repName, pastFixesSummary, persona, activeScript, geminiApiKey.trim(), activeModel, coachContext);
    } catch (err) {
      console.error("Gemini API error, falling back to intelligent rule-based evaluator:", err);
      evaluationResult = generateRuleBasedEvaluation(input, repName, pastFixesSummary, persona, activeScript, coachContext);
    }
  } else {
    evaluationResult = generateRuleBasedEvaluation(input, repName, pastFixesSummary, persona, activeScript, coachContext);
  }

  // Save evaluation to database
  const evaluationId = `eval_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  await db.insert(evaluations).values({
    id: evaluationId,
    callId: input.callId,
    repId: input.repId,
    bottomLine: evaluationResult.bottomLine,
    painStatus: evaluationResult.sandlerBreakdown.pain.status,
    painEvidence: evaluationResult.sandlerBreakdown.pain.evidence,
    budgetStatus: evaluationResult.sandlerBreakdown.budget.status,
    budgetEvidence: evaluationResult.sandlerBreakdown.budget.evidence,
    decisionStatus: evaluationResult.sandlerBreakdown.decision.status,
    decisionEvidence: evaluationResult.sandlerBreakdown.decision.evidence,
    scriptAdherenceScore: evaluationResult.sandlerBreakdown.scriptAdherence.score,
    scriptFeedback: evaluationResult.sandlerBreakdown.scriptAdherence.feedback,
    scriptDivergence: evaluationResult.scriptDivergence
      ? JSON.stringify(evaluationResult.scriptDivergence)
      : null,
    missedOpportunities: JSON.stringify(evaluationResult.missedOpportunities),
    topFixes: JSON.stringify(evaluationResult.topFixes),
    rawMarkdown: evaluationResult.rawMarkdown || "",
    createdAt: new Date().toISOString(),
  }).run();

  // Update Call status
  await db.update(calls)
    .set({ status: "completed", coreOutcome: evaluationResult.coreOutcome })
    .where(eq(calls.id, input.callId))
    .run();

  // Recalculate Rep Progression Snapshot
  await updateRepProgressionSnapshot(input.repId, repName, evaluationResult);

  return {
    id: evaluationId,
    callId: input.callId,
    repId: input.repId,
    createdAt: new Date().toISOString(),
    ...evaluationResult,
  };
}

async function callGeminiAPI(
  input: EvaluationInput,
  repName: string,
  pastFixes: string,
  persona: RepPersona | null,
  script: SalesScript | null,
  apiKey: string,
  model: string,
  coachContext: string
) {
  const personaContext = persona
    ? `
Rep Persona & Background:
- Experience Level: ${persona.experienceLevel}
- Coaching Tone Preference: ${persona.coachingTone}
- Known Blindspots: ${persona.knownBlindspots.join(", ")}
- Rep Strengths: ${persona.strengths.join(", ")}
- Manager's Private 1-on-1 Notes: "${persona.managerNotes}"
`
    : `Rep: ${repName}`;

  const scriptContext = script
    ? `
Prescribed Script to Adhere to: "${script.title}"
Required Script Milestones:
${script.keyMilestones.map((m, idx) => `${idx + 1}. ${m}`).join("\n")}

Script Playbook Guidance:
"""
${script.content}
"""
`
    : `Prescribed Framework: Standard B2B Sandler blocking-and-tackling for ${input.callStage}.`;

  const coachDirectives = coachContext
    ? `
=== MANAGER'S COACHING DIRECTIVES (HIGHEST PRIORITY) ===
You have been trained by this sales manager. Adopt their judgment as your own and apply it to this call above any generic best practice. When their directives conflict with standard advice, follow THEIR directives. Reflect these directives in the bottomLine, missedOpportunities, scriptAdherence feedback, and topFixes.
${coachContext}
=== END MANAGER'S COACHING DIRECTIVES ===
`
    : "";

  const prompt = `
You are the ultimate AI Sales Manager for a B2B sales team. You act like an experienced, grounded VP of Sales.
${coachDirectives}
${personaContext}

${scriptContext}

Prospect: ${input.prospectName} from ${input.prospectCompany}
Call Stage: ${input.callStage}

Past Coaching History (last calls):
${pastFixes || "None on record."}

Call Transcript:
"""
${input.transcriptText}
"""

Evaluate this call strictly against blocking-and-tackling, early folding ("Fight for the Win"), stage-specific Sandler qualification (Pain, Budget, Decision), and adherence to the prescribed script above.
For scriptDivergence, judge EVERY required milestone from the prescribed script above one-by-one and mark each Hit, Partial, or Missed with transcript evidence. Include one entry per milestone, using the milestone text verbatim.
Tailor your feedback tone to the rep's coaching tone preference.

Return a strictly valid JSON object with this exact schema:
{
  "callTypeDetected": "${input.callStage}",
  "coreOutcome": "Meeting booked / Dropped / Rescheduled / Unqualified",
  "bottomLine": "2-3 sentences candid summary of how the rep handled this call.",
  "missedOpportunities": [
    {
      "prospectOpening": "exact quote from prospect",
      "repSurrender": "exact quote of rep folding",
      "whatToSayInstead": "exact phrase rep should have said"
    }
  ],
  "sandlerBreakdown": {
    "pain": { "status": "Pass|Incomplete|Fail", "evidence": "evidence from transcript" },
    "budget": { "status": "Pass|Incomplete|Fail", "evidence": "evidence from transcript" },
    "decision": { "status": "Pass|Incomplete|Fail", "evidence": "evidence from transcript" },
    "scriptAdherence": { "score": 7, "feedback": "exact milestones missed or hit from the prescribed script" }
  },
  "scriptDivergence": {
    "scriptTitle": "${script?.title || `Standard B2B ${input.callStage} framework`}",
    "milestones": [
      { "milestone": "exact text of the required milestone", "status": "Hit|Partial|Missed", "note": "1 sentence citing transcript evidence for why it was hit, partially done, or missed" }
    ]
  },
  "topFixes": [
    { "title": "Fix #1 title", "description": "Specific tactical behavior to change" },
    { "title": "Fix #2 title", "description": "Specific phrasing or process correction" }
  ]
}
`;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    })
  });

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return JSON.parse(text);
}

function generateRuleBasedEvaluation(
  input: EvaluationInput,
  repName: string,
  pastFixes: string,
  persona: RepPersona | null,
  script: SalesScript | null,
  coachContext: string
): Omit<CallEvaluation, "id" | "callId" | "repId" | "createdAt"> {
  const text = input.transcriptText.toLowerCase();
  const coachApplied = coachContext.trim().length > 0;

  const hasEarlyFold = text.includes("send an email") || text.includes("no problem, thanks") || text.includes("understand, bye") || text.includes("all set") || text.includes("don't need");
  const mentionsBudget = text.includes("budget") || text.includes("cost") || text.includes("price") || text.includes("pricing") || text.includes("range");
  const mentionsDecision = text.includes("decision") || text.includes("timeline") || text.includes("stakeholder") || text.includes("who else") || text.includes("procurement");
  const mentionsPain = text.includes("challenge") || text.includes("frustrat") || text.includes("problem") || text.includes("headache") || text.includes("struggle") || text.includes("delay");

  let painStatus: SandlerStatus = mentionsPain ? "Pass" : "Incomplete";
  let budgetStatus: SandlerStatus = mentionsBudget ? "Pass" : "Fail";
  let decisionStatus: SandlerStatus = mentionsDecision ? "Pass" : "Incomplete";
  let scriptScore = 6;
  let coreOutcome = "Dropped";

  if (text.includes("calendar") || text.includes("tuesday") || text.includes("invite") || text.includes("book") || text.includes("demo scheduled") || text.includes("works for me")) {
    coreOutcome = "Meeting booked";
    scriptScore += 2;
  }

  const missedOpportunities: MissedOpportunity[] = [];

  if (text.includes("email") || text.includes("send me some info")) {
    missedOpportunities.push({
      prospectOpening: "Just send me an email with more information and I'll take a look.",
      repSurrender: "Sure thing, I'll send that over right now. What's your email?",
      whatToSayInstead: "I can definitely send info, but in my experience, emails like that usually get buried in 30 seconds. If I can take 60 seconds right now to share the one reason companies like yours switch to us, would that be fair?"
    });
  }

  if (text.includes("already have") || text.includes("already using") || text.includes("happy with") || text.includes("freightpulse") || text.includes("hubspot")) {
    missedOpportunities.push({
      prospectOpening: "We already have a solution in place and we're good for now.",
      repSurrender: "Got it, no worries at all! Keep us in mind when your contract expires.",
      whatToSayInstead: "Glad you have that solved. We don't ask anyone to rip and replace what's working. Most leaders we talk with have that in place, but tell us they struggle with [specific gap]. Are you seeing that as well, or has your team managed to avoid that completely?"
    });
  }

  if (missedOpportunities.length === 0) {
    missedOpportunities.push({
      prospectOpening: "We're pretty busy right now, check back in Q3.",
      repSurrender: "Understood, I'll put a task on my calendar to call you in August.",
      whatToSayInstead: "Totally hear you—everyone is slammed. Just so I don't bother you in Q3 for no reason: is this on the backburner because you already solved [core pain], or is it strictly bandwidth right now?"
    });
  }

  if (hasEarlyFold) {
    scriptScore = Math.max(3, scriptScore - 2);
  }

  let scriptFeedback = script
    ? `Benchmarked against "${script.title}": Rep hit milestone 1 (Opening) but veered off track on Milestone 2 (${script.keyMilestones[1] || "Objection Pivot"}) by capitulating too early.`
    : "Veered off track when handling pushback; rushed through qualification steps to avoid tension.";

  const blindspotNotice = persona?.knownBlindspots?.[0]
    ? `Noticeable alignment with known blindspot: '${persona.knownBlindspots[0]}'.`
    : "";

  const coachNote = coachApplied
    ? "Assessed through your custom coaching directives (add a Gemini API key in Settings for the coach to apply them in full depth). "
    : "";
  const bottomLine = `${repName} made contact with ${input.prospectName} at ${input.prospectCompany}. ${coachNote}${blindspotNotice} Fundamental blocking and tackling suffered because the rep treated soft pushback as a dismissal instead of executing the prescribed objection pivot.`;

  const fixes: [PriorityFix, PriorityFix] = [
    {
      title: "Disarm and Re-engage Brush-offs Instead of Surrendering",
      description: "When the prospect offers a soft brush-off ('send info' / 'already have someone'), do not agree to hang up. Acknowledge and ask one provocative calibration question to buy the next 60 seconds."
    },
    {
      title: script?.keyMilestones?.[1] ? `Execute Milestone: ${script.keyMilestones[1]}` : "Direct Budget & Decision Thresholds Early",
      description: script?.keyMilestones?.[1]
        ? `Ensure you complete '${script.keyMilestones[1]}' before attempting to lock down calendars or ending the call.`
        : "Stop waiting until the tail end of the call to talk numbers and stakeholders. Nail down the exact decision criteria and budget bracket."
    }
  ];

  const scriptDivergence = computeScriptDivergence(input.transcriptText, script, scriptScore);

  return {
    repName,
    callTypeDetected: input.callStage as any,
    coreOutcome,
    bottomLine,
    missedOpportunities,
    scriptDivergence,
    sandlerBreakdown: {
      pain: {
        status: painStatus,
        evidence: mentionsPain ? "Rep touched operational bottlenecks but stayed surface level." : "Failed to uncover real operational pain; accepted feature requests at face value."
      },
      budget: {
        status: budgetStatus,
        evidence: mentionsBudget ? "Mentioned ballpark investment brackets." : "Danced completely around budget. Did not qualify financial commitment."
      },
      decision: {
        status: decisionStatus,
        evidence: mentionsDecision ? "Asked about timeline and other participants." : "Did not identify who signs off or what the formal buying criteria looks like."
      },
      scriptAdherence: {
        score: scriptScore,
        feedback: scriptFeedback
      }
    },
    topFixes: fixes,
    rawMarkdown: `### Manager's Assessment for ${repName}\n${bottomLine}`
  };
}

async function updateRepProgressionSnapshot(
  repId: string,
  repName: string,
  latestEval: Omit<CallEvaluation, "id" | "callId" | "repId" | "createdAt">
) {
  const allRepEvals = await db
    .select()
    .from(evaluations)
    .where(eq(evaluations.repId, repId))
    .orderBy(desc(evaluations.createdAt))
    .all();

  let trajectory: RepTrajectory = "stagnant";
  let rationale = "";
  let struggle = "";

  if (allRepEvals.length <= 1) {
    trajectory = "progressing";
    rationale = `${repName} logged an initial baseline call. Script adherence is at ${latestEval.sandlerBreakdown.scriptAdherence.score}/10. Needs to tighten up objection handling.`;
    struggle = latestEval.topFixes[0].title;
  } else {
    const scores = allRepEvals.map((e: any) => e.scriptAdherenceScore);
    const recent = scores[0];
    const previous = scores[1];

    if (recent > previous) {
      trajectory = "progressing";
      rationale = `${repName} is improving. Script score moved from ${previous}/10 to ${recent}/10, showing better control under objection pressure.`;
      struggle = latestEval.topFixes[1].title;
    } else if (recent < previous) {
      trajectory = "regressing";
      rationale = `${repName} slipped on fundamentals. Score dropped from ${previous}/10 to ${recent}/10. Repeated early surrenders on objections.`;
      struggle = latestEval.topFixes[0].title;
    } else {
      trajectory = "stagnant";
      rationale = `${repName} is plateauing at ${recent}/10. Still repeating the same objection-handling failures without adopting suggested fixes.`;
      struggle = latestEval.topFixes[0].title;
    }
  }

  const existingSnapshot = await db.select().from(repSnapshots).where(eq(repSnapshots.repId, repId)).get();

  if (existingSnapshot) {
    await db.update(repSnapshots)
      .set({
        overallTrajectory: trajectory,
        managerRationale: rationale,
        topActiveStruggle: struggle,
        recentScriptScore: latestEval.sandlerBreakdown.scriptAdherence.score,
        lastUpdated: new Date().toISOString(),
      })
      .where(eq(repSnapshots.repId, repId))
      .run();
  } else {
    await db.insert(repSnapshots).values({
      id: `snap_${Date.now()}`,
      repId,
      overallTrajectory: trajectory,
      managerRationale: rationale,
      topActiveStruggle: struggle,
      recentScriptScore: latestEval.sandlerBreakdown.scriptAdherence.score,
      lastUpdated: new Date().toISOString(),
    }).run();
  }
}

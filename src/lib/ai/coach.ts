import { db } from "../db";
import { evaluations, calls, reps, repSnapshots } from "../db/schema";
import { getActiveScriptForStage, getRepPersona, getCoachContext } from "../db/service";
import { latestEvaluationsByCall } from "../evaluations";
import { computeScriptDivergence } from "../callInsights";
import { eq, desc } from "drizzle-orm";
import type { CallEvaluation, MissedOpportunity, PriorityFix, SandlerStatus, RepTrajectory, SalesScript, RepPersona } from "@/types";
import { completeJson } from "./llm";
import { resolveAiSettings } from "./settings";
import {
  attachCitesToScorecard,
  buildScorecardFromSandler,
  buildWalkthroughFromTranscript,
  stampMissedOpportunities,
  type ExtendedReview,
  type ScorecardMetric,
  type CoachWalkthroughStep,
} from "./review";
import { parseTranscript, requireUsableTranscript } from "../transcript";

interface EvaluationInput {
  callId: string;
  repId: string;
  transcriptText: string;
  callStage: string;
  prospectCompany: string;
  prospectName: string;
  durationSeconds?: number;
}

export async function evaluateCall(input: EvaluationInput): Promise<CallEvaluation> {
  requireUsableTranscript(input.transcriptText);
  const rep = await db.select().from(reps).where(eq(reps.id, input.repId)).get();
  const repName = rep?.name || "Rep";
  const durationSeconds = input.durationSeconds ?? 0;

  const persona = await getRepPersona(input.repId);
  const activeScript = await getActiveScriptForStage(input.callStage);

  const previousEvals = (await db
    .select()
    .from(evaluations)
    .where(eq(evaluations.repId, input.repId))
    .orderBy(desc(evaluations.createdAt))
    .limit(8)
    .all())
    .filter((e: { callId: string }) => e.callId !== input.callId)
    .slice(0, 3);

  const pastFixesSummary = previousEvals.map((e: any, idx: number) => {
    try {
      const fixes = JSON.parse(e.topFixes) as PriorityFix[];
      return `Call -${idx + 1} Fixes: ${fixes.map((f) => f.title).join("; ")}`;
    } catch {
      return "";
    }
  }).filter(Boolean).join("\n");

  const coachContext = await getCoachContext();
  const ai = await resolveAiSettings();

  let evaluationResult: Omit<CallEvaluation, "id" | "callId" | "repId" | "createdAt">;

  if (ai.apiKey) {
    try {
      evaluationResult = await callLlmEvaluation(
        input,
        repName,
        pastFixesSummary,
        persona,
        activeScript,
        ai.apiKey,
        ai.providerId,
        ai.model,
        coachContext,
        durationSeconds
      );
    } catch (err) {
      const message = llmErrorMessage(err);
      console.error("LLM evaluation error, falling back to rule-based evaluator:", message);
      evaluationResult = generateRuleBasedEvaluation(input, repName, pastFixesSummary, persona, activeScript, coachContext, durationSeconds);
      evaluationResult.evaluatedWith = {
        provider: ai.providerId,
        model: ai.model,
        fallback: "rules",
        error: message,
      };
    }
  } else {
    evaluationResult = generateRuleBasedEvaluation(input, repName, pastFixesSummary, persona, activeScript, coachContext, durationSeconds);
  }

  evaluationResult.missedOpportunities = stampMissedOpportunities(
    evaluationResult.missedOpportunities,
    input.transcriptText,
    durationSeconds
  );
  if (evaluationResult.scorecard) {
    evaluationResult.scorecard = attachCitesToScorecard(evaluationResult.scorecard, input.transcriptText, durationSeconds);
  }
  if (!evaluationResult.walkthrough?.length) {
    evaluationResult.walkthrough = buildWalkthroughFromTranscript(
      input.transcriptText,
      durationSeconds,
      evaluationResult.missedOpportunities,
      repName
    );
  }

  const extendedReview: ExtendedReview = {
    scorecard: evaluationResult.scorecard || [],
    walkthrough: evaluationResult.walkthrough || [],
    evaluatedWith: evaluationResult.evaluatedWith,
  };

  const evaluationId = `eval_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  // Replace the previous review for this call so reanalyze does not leave stale scores.
  await db.delete(evaluations).where(eq(evaluations.callId, input.callId)).run();
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
    extendedReview: JSON.stringify(extendedReview),
    createdAt: new Date().toISOString(),
  }).run();

  await db.update(calls)
    .set({ status: "completed", coreOutcome: evaluationResult.coreOutcome })
    .where(eq(calls.id, input.callId))
    .run();

  await updateRepProgressionSnapshot(input.repId, repName, evaluationResult);

  return {
    id: evaluationId,
    callId: input.callId,
    repId: input.repId,
    createdAt: new Date().toISOString(),
    ...evaluationResult,
  };
}

function timestampedTranscript(transcriptText: string, durationSeconds: number): string {
  const turns = parseTranscript(transcriptText, durationSeconds);
  if (!turns.length) return transcriptText;
  return turns.map((t) => `[${t.timestamp}] ${t.speaker}: ${t.text}`).join("\n");
}

async function callLlmEvaluation(
  input: EvaluationInput,
  repName: string,
  pastFixes: string,
  persona: RepPersona | null,
  script: SalesScript | null,
  apiKey: string,
  providerId: Parameters<typeof completeJson>[0]["providerId"],
  model: string,
  coachContext: string,
  durationSeconds: number
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
You have been trained by this sales manager. Adopt their judgment as your own and apply it to this call above any generic best practice. When their directives conflict with standard advice, follow THEIR directives. Reflect these directives in the bottomLine, missedOpportunities, scriptAdherence feedback, scorecard, walkthrough, and topFixes.
${coachContext}
=== END MANAGER'S COACHING DIRECTIVES ===
`
    : "";

  const stamped = timestampedTranscript(input.transcriptText, durationSeconds);

  const prompt = `
You are the ultimate AI Sales Manager for a B2B sales team. You act like an experienced, grounded VP of Sales reviewing a call WITH a coach sitting next to you. Pick the call apart beat by beat.
${coachDirectives}
${personaContext}

${scriptContext}

Prospect: ${input.prospectName} from ${input.prospectCompany}
Call Stage: ${input.callStage}
Call duration: ${durationSeconds} seconds

Past Coaching History (last calls):
${pastFixes || "None on record."}

Call Transcript (each line is prefixed with an estimated clock time [m:ss]):
"""
${stamped}
"""

EVIDENCE RULES (non-negotiable):
- Every claim must cite the clock time from the transcript prefix AND the exact quote.
- If you say they folded, write the timestamp (e.g. "1:12") and the exact sentence they said.
- Never paraphrase a surrender. Quote it.
- If the transcript already had timestamps, use those. Otherwise use the [m:ss] prefixes above.

Evaluate against:
1. Blocking-and-tackling / early folding ("Fight for the Win")
2. Stage-specific Sandler qualification (Pain, Budget, Decision)
3. Next-step firmness (calendar lock vs "I'll send something")
4. Discovery depth (questions vs pitch)
5. Control & pacing (who drove the call)
6. Peer authority / tone
7. Adherence to the prescribed script

For scriptDivergence, judge EVERY required milestone one-by-one (Hit / Partial / Missed) with timestamp + quote.
For walkthrough, produce 6–12 sequential coaching steps covering the WHOLE call — not just the disasters. Each step is one moment a coach would pause the tape: what happened, and exactly what they should have done HERE. If they did it right, verdict is "good" and shouldHaveDone is empty.

Return a strictly valid JSON object with this exact schema:
{
  "callTypeDetected": "${input.callStage}",
  "coreOutcome": "Meeting booked / Dropped / Rescheduled / Unqualified",
  "bottomLine": "2-3 sentences candid summary. Cite at least one [m:ss] timestamp.",
  "missedOpportunities": [
    {
      "timestamp": "1:12",
      "timestampSeconds": 72,
      "prospectOpening": "exact quote from prospect",
      "prospectQuote": "exact quote from prospect",
      "repSurrender": "exact quote of rep folding",
      "repQuote": "exact quote of rep folding",
      "whatToSayInstead": "exact phrase rep should have said at that timestamp"
    }
  ],
  "sandlerBreakdown": {
    "pain": { "status": "Pass|Incomplete|Fail", "evidence": "[m:ss] \\"exact quote\\" — interpretation" },
    "budget": { "status": "Pass|Incomplete|Fail", "evidence": "[m:ss] \\"exact quote\\" — interpretation" },
    "decision": { "status": "Pass|Incomplete|Fail", "evidence": "[m:ss] \\"exact quote\\" — interpretation" },
    "scriptAdherence": { "score": 7, "feedback": "milestones hit or missed, each with a timestamp" }
  },
  "scorecard": [
    { "key": "pain", "label": "Pain", "status": "Pass|Incomplete|Fail", "score": 7, "evidence": "one sentence", "cite": { "timestamp": "0:42", "timestampSeconds": 42, "quote": "exact line" } },
    { "key": "budget", "label": "Budget", "status": "Pass|Incomplete|Fail", "score": 4, "evidence": "one sentence", "cite": { "timestamp": "2:10", "timestampSeconds": 130, "quote": "exact line" } },
    { "key": "decision", "label": "Decision", "status": "Pass|Incomplete|Fail", "score": 3, "evidence": "one sentence", "cite": { "timestamp": "2:40", "timestampSeconds": 160, "quote": "exact line" } },
    { "key": "fightForTheWin", "label": "Fight for the Win", "status": "Fail", "score": 2, "evidence": "one sentence", "cite": { "timestamp": "1:12", "timestampSeconds": 72, "quote": "exact fold" } },
    { "key": "nextStep", "label": "Next-step firmness", "status": "Fail", "score": 2, "evidence": "one sentence", "cite": { "timestamp": "1:40", "timestampSeconds": 100, "quote": "exact line" } },
    { "key": "discoveryDepth", "label": "Discovery depth", "status": "Incomplete", "score": 4, "evidence": "one sentence", "cite": { "timestamp": "0:22", "timestampSeconds": 22, "quote": "exact line" } },
    { "key": "controlAndPacing", "label": "Control & pacing", "status": "Incomplete", "score": 4, "evidence": "one sentence", "cite": { "timestamp": "0:04", "timestampSeconds": 4, "quote": "exact line" } },
    { "key": "peerAuthority", "label": "Peer authority", "status": "Fail", "score": 3, "evidence": "one sentence", "cite": { "timestamp": "0:04", "timestampSeconds": 4, "quote": "exact line" } }
  ],
  "walkthrough": [
    {
      "step": 1,
      "timestamp": "0:04",
      "timestampSeconds": 4,
      "speaker": "Rep name",
      "quote": "exact transcript line",
      "whatHappened": "one sentence a coach would say while pausing the tape",
      "shouldHaveDone": "exact alternative, or empty string if they did it right",
      "verdict": "good|coach|miss|fatal",
      "category": "Opener|Objection|Pain|Budget|Decision|Close|Tone"
    }
  ],
  "scriptDivergence": {
    "scriptTitle": "${script?.title || `Standard B2B ${input.callStage} framework`}",
    "milestones": [
      { "milestone": "exact text of the required milestone", "status": "Hit|Partial|Missed", "note": "1 sentence with [m:ss] and quote", "timestamp": "0:18", "quote": "exact line" }
    ]
  },
  "topFixes": [
    { "title": "Fix #1 title", "description": "Specific tactical behavior to change, citing the timestamp where it failed" },
    { "title": "Fix #2 title", "description": "Specific phrasing or process correction, citing the timestamp" }
  ]
}
`;

  const result = await completeJson({ providerId, apiKey, model, prompt });
  const parsed = result.parsed || {};

  const missed: MissedOpportunity[] = Array.isArray(parsed.missedOpportunities) ? parsed.missedOpportunities : [];
  const scorecard: ScorecardMetric[] | undefined = Array.isArray(parsed.scorecard) ? parsed.scorecard : undefined;
  const walkthrough: CoachWalkthroughStep[] | undefined = Array.isArray(parsed.walkthrough) ? parsed.walkthrough : undefined;

  return {
    repName,
    callTypeDetected: parsed.callTypeDetected || input.callStage,
    coreOutcome: parsed.coreOutcome || "Dropped",
    bottomLine: parsed.bottomLine || "",
    missedOpportunities: missed,
    sandlerBreakdown: normalizeSandlerBreakdown(parsed.sandlerBreakdown),
    scriptDivergence: parsed.scriptDivergence,
    topFixes: normalizeTopFixes(parsed.topFixes),
    scorecard,
    walkthrough,
    evaluatedWith: {
      provider: providerId,
      model,
      estimatedCostUsd: result.estimatedCostUsd,
    },
    rawMarkdown: `### Manager's Assessment for ${repName}\n${parsed.bottomLine || ""}`,
  };
}

function llmErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return raw.replace(/\s+/g, " ").trim().slice(0, 280) || "Provider request failed";
}

function normalizeSandlerStatus(value: unknown): SandlerStatus {
  return value === "Pass" || value === "Fail" || value === "Incomplete" ? value : "Incomplete";
}

function normalizeSandlerBreakdown(raw: any): CallEvaluation["sandlerBreakdown"] {
  const sb = raw && typeof raw === "object" ? raw : {};
  const score = Number(sb.scriptAdherence?.score);
  return {
    pain: { status: normalizeSandlerStatus(sb.pain?.status), evidence: String(sb.pain?.evidence || "") },
    budget: { status: normalizeSandlerStatus(sb.budget?.status), evidence: String(sb.budget?.evidence || "") },
    decision: { status: normalizeSandlerStatus(sb.decision?.status), evidence: String(sb.decision?.evidence || "") },
    scriptAdherence: {
      score: Number.isFinite(score) ? Math.min(10, Math.max(1, Math.round(score))) : 5,
      feedback: String(sb.scriptAdherence?.feedback || ""),
    },
  };
}

function normalizeTopFixes(raw: unknown): [PriorityFix, PriorityFix] {
  const fixes = Array.isArray(raw) ? raw : [];
  const first = fixes[0] && typeof fixes[0] === "object" ? fixes[0] : {};
  const second = fixes[1] && typeof fixes[1] === "object" ? fixes[1] : {};
  return [
    {
      title: String(first.title || "Tighten the next call"),
      description: String(first.description || "Revisit the moments flagged on this tape."),
    },
    {
      title: String(second.title || "Lock a next step"),
      description: String(second.description || "Leave with a calendar commitment, not a vague follow-up."),
    },
  ];
}

function generateRuleBasedEvaluation(
  input: EvaluationInput,
  repName: string,
  pastFixes: string,
  persona: RepPersona | null,
  script: SalesScript | null,
  coachContext: string,
  durationSeconds: number
): Omit<CallEvaluation, "id" | "callId" | "repId" | "createdAt"> {
  const text = input.transcriptText.toLowerCase();
  const coachApplied = coachContext.trim().length > 0;
  const turns = parseTranscript(input.transcriptText, durationSeconds);

  const hasEarlyFold = text.includes("send an email") || text.includes("no problem, thanks") || text.includes("understand, bye") || text.includes("all set") || text.includes("don't need") || text.includes("i'll send that");
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

  const stampQuote = (quote: string) => {
    const hit = turns.find((t) => t.text.toLowerCase().includes(quote.slice(0, 24).toLowerCase()));
    return hit;
  };

  if (text.includes("email") || text.includes("send me some info")) {
    const prospect = stampQuote("send me an email") || stampQuote("email");
    const surrender = stampQuote("i'll send") || stampQuote("absolutely");
    missedOpportunities.push({
      prospectOpening: prospect?.text || "Just send me an email with more information and I'll take a look.",
      repSurrender: surrender?.text || "Sure thing, I'll send that over right now. What's your email?",
      whatToSayInstead: "I can definitely send info, but in my experience, emails like that usually get buried in 30 seconds. If I can take 60 seconds right now to share the one reason companies like yours switch to us, would that be fair?",
      timestamp: (surrender || prospect)?.timestamp,
      timestampSeconds: (surrender || prospect)?.timestampSeconds,
      prospectQuote: prospect?.text,
      repQuote: surrender?.text,
    });
  }

  if (text.includes("already have") || text.includes("already using") || text.includes("happy with") || text.includes("freightpulse") || text.includes("hubspot") || text.includes("benchling")) {
    const prospect = stampQuote("already have") || stampQuote("already");
    const surrender = stampQuote("no problem") || stampQuote("no worries") || stampQuote("got it");
    missedOpportunities.push({
      prospectOpening: prospect?.text || "We already have a solution in place and we're good for now.",
      repSurrender: surrender?.text || "Got it, no worries at all! Keep us in mind when your contract expires.",
      whatToSayInstead: "Glad you have that solved. We don't ask anyone to rip and replace what's working. Most leaders we talk with have that in place, but tell us they struggle with [specific gap]. Are you seeing that as well, or has your team managed to avoid that completely?",
      timestamp: (surrender || prospect)?.timestamp,
      timestampSeconds: (surrender || prospect)?.timestampSeconds,
      prospectQuote: prospect?.text,
      repQuote: surrender?.text,
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

  const foldTurn = turns.find((t) => /send (me )?an email|i'll send|no problem|absolutely/i.test(t.text));
  const foldCite = foldTurn ? ` At ${foldTurn.timestamp} they said: "${foldTurn.text}"` : "";

  const coachNote = coachApplied
    ? "Assessed through your custom coaching directives (add an AI API key in Settings for the coach to apply them in full depth). "
    : "";
  const bottomLine = `${repName} made contact with ${input.prospectName} at ${input.prospectCompany}. ${coachNote}${blindspotNotice} Fundamental blocking and tackling suffered because the rep treated soft pushback as a dismissal instead of executing the prescribed objection pivot.${foldCite}`;

  const fixes: [PriorityFix, PriorityFix] = [
    {
      title: "Disarm and Re-engage Brush-offs Instead of Surrendering",
      description: foldTurn
        ? `At ${foldTurn.timestamp} ("${foldTurn.text.slice(0, 80)}"), do not agree to hang up. Acknowledge and ask one provocative calibration question to buy the next 60 seconds.`
        : "When the prospect offers a soft brush-off ('send info' / 'already have someone'), do not agree to hang up. Acknowledge and ask one provocative calibration question to buy the next 60 seconds."
    },
    {
      title: script?.keyMilestones?.[1] ? `Execute Milestone: ${script.keyMilestones[1]}` : "Direct Budget & Decision Thresholds Early",
      description: script?.keyMilestones?.[1]
        ? `Ensure you complete '${script.keyMilestones[1]}' before attempting to lock down calendars or ending the call.`
        : "Stop waiting until the tail end of the call to talk numbers and stakeholders. Nail down the exact decision criteria and budget bracket."
    }
  ];

  const scriptDivergence = computeScriptDivergence(input.transcriptText, script, scriptScore);
  const scorecard = attachCitesToScorecard(
    buildScorecardFromSandler({
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
      scriptScore,
      missedCount: missedOpportunities.length,
      coreOutcome,
      foldedEarly: hasEarlyFold,
    }),
    input.transcriptText,
    durationSeconds
  );

  const walkthrough = buildWalkthroughFromTranscript(input.transcriptText, durationSeconds, missedOpportunities, repName);

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
    scorecard,
    walkthrough,
    rawMarkdown: `### Manager's Assessment for ${repName}\n${bottomLine}`
  };
}

async function updateRepProgressionSnapshot(
  repId: string,
  repName: string,
  latestEval: Omit<CallEvaluation, "id" | "callId" | "repId" | "createdAt">
) {
  const allRepEvals = latestEvaluationsByCall(
    await db
      .select()
      .from(evaluations)
      .where(eq(evaluations.repId, repId))
      .orderBy(desc(evaluations.createdAt))
      .all()
  );

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

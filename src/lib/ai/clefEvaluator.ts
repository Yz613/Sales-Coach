import { untrustedEvidence, EVIDENCE_POLICY } from "./evidence";
import type {
  CallEvaluation,
  MissedOpportunity,
  PriorityFix,
  SalesScript,
  SandlerStatus,
  ScriptDivergence,
} from "@/types";
import {
  CLEF_DECISION_SCHEMA_VERSION,
  CLEF_PRIMARY_MODEL,
  evaluateAnswerConfidence,
  runClefDecisions,
  type ClefAnswer,
  type ClefDecisionResult,
  type ClefQuestion,
  type ClefScoreAnswer,
} from "./clefDecisionProvider";
import {
  attachCitesToScorecard,
  buildWalkthroughFromTranscript,
  SCORECARD_KEYS,
  SCORECARD_LABELS,
  stampMissedOpportunities,
  type ClefDecisionMetadata,
  type CoachWalkthroughStep,
  type EvaluatedWith,
  type ScorecardKey,
  type ScorecardMetric,
} from "./review";
import { parseTranscript } from "../transcript";
import { classifyCoreOutcomeFromTranscript, normalizeCoreOutcome } from "../coreOutcome";
import { computeScriptDivergence } from "../callInsights";
import {
  deriveCoachingBrief,
  formatMethodologyBlock,
  isMicroSkillKey,
  type CoachingBrief,
  type SalesMethodology,
} from "../methodology";
import { scoreMethodDebrief } from "../salesMethods";
import { completeJson } from "./llm";
import { EVALUATION_RESPONSE_SCHEMA } from "./evaluationSchema";
import { formatProspectContext } from "../callLabel";
import { revenueRuntime } from "../revenue/runtime";

// Clef accepts at most ten ordered criteria. It returns their zero-based index;
// the UI's 0-10 score is derived from the resulting 0-9 expected score below.
export const CLEF_SCORE_CRITERIA_0_TO_9: string[] = [
  "0: Completely absent, counter-productive, or harmful to the deal",
  "1: Extremely poor; critical breakdowns, no technique",
  "2: Poor execution; severe gaps with only token attempt",
  "3: Substandard execution; falls well below standard expectations",
  "4: Partial/weak execution; inconsistent attempt with notable gaps",
  "5: Moderate/mixed execution; basic attempt but lacking depth or firmness",
  "6: Reasonable execution; meets basic requirements with minor gaps",
  "7: Good execution; solid technique evidenced throughout",
  "8: Strong execution; proactive, disciplined, and clearly proficient",
  "9: Exceptional and clearly evidenced masterclass execution",
];

export type ClefEvaluationMode = "shadow" | "primary" | "off";

export function getClefEvaluationMode(): ClefEvaluationMode {
  const envVal = (
    process.env.CLEF_EVALUATION_MODE ||
    (revenueRuntime().env?.CLEF_EVALUATION_MODE as string | undefined) ||
    ""
  ).toLowerCase().trim();
  if (envVal === "shadow" || envVal === "primary" || envVal === "off") {
    return envVal;
  }
  return "primary";
}

export function statusFromClefScore(score: number): SandlerStatus {
  if (score >= 7) return "Pass";
  if (score >= 4) return "Incomplete";
  return "Fail";
}

export interface ClefEvaluationStateInput {
  transcriptText: string;
  durationSeconds?: number;
  callStage: string;
  repName?: string;
  prospectCompany?: string;
  prospectName?: string;
  methodology: SalesMethodology;
  script?: SalesScript | null;
  coachContext?: string;
}

/**
 * Builds a structured state containing only the information needed to score the call.
 * Does NOT include API keys, tokens, or unrelated workspace information.
 * Metric weights are excluded so they do not bias Clef's assessment.
 */
export function buildClefDecisionState(input: ClefEvaluationStateInput): string {
  const duration = input.durationSeconds ?? 0;
  const turns = parseTranscript(input.transcriptText, duration);
  const formattedTranscript = turns.length
    ? turns.map((t) => `[${t.timestamp}] ${t.speaker}: ${t.text}`).join("\n")
    : input.transcriptText;

  const prospectCtx = formatProspectContext({
    prospectCompany: input.prospectCompany || "",
    prospectName: input.prospectName || "",
  });

  const parts: string[] = [
    EVIDENCE_POLICY,
    `=== CALL CONTEXT ===`,
    `Pipeline Stage: ${input.callStage}`,
    untrustedEvidence("Sales representative", input.repName || "Rep"),
    prospectCtx ? untrustedEvidence("Prospect", prospectCtx) : "",
    `Call Duration: ${duration} seconds`,
    "",
    `=== CONFIGURED METHODOLOGY: ${input.methodology.name} ===`,
    `Evaluation Focus:`,
    ...input.methodology.evaluationFocus.map((line, idx) => `${idx + 1}. ${line}`),
    "",
    `=== QUALIFICATION RUBRIC ===`,
    ...input.methodology.pillars.map(
      (p) => `[Slot: ${p.label} (${p.key})]\nSummary: ${p.summary}\nRubric Criteria:\n${p.rubric}\n`
    ),
  ];

  if (input.methodology.microSkills?.length) {
    parts.push(
      `=== METHODOLOGY SKILLS CHECKLIST ===`,
      ...input.methodology.microSkills.map((s) => `[Skill: ${s.label} (${s.key})]\n${s.rubric}\n`)
    );
  }

  if (input.script) {
    parts.push(
      `=== PRESCRIBED TALK TRACK: ${input.script.title} ===`,
      `Required Milestones:`,
      ...input.script.keyMilestones.map((m, idx) => `${idx + 1}. ${m}`),
      `Playbook Guidance:`,
      input.script.content,
      ""
    );
  }

  if (input.coachContext?.trim()) {
    parts.push(
      `=== MANAGER'S COACHING DIRECTIVES ===`,
      input.coachContext.trim(),
      ""
    );
  }

  parts.push(
    untrustedEvidence("Call transcript", formattedTranscript)
  );

  return parts.filter(Boolean).join("\n");
}

/**
 * Dynamically generates Clef questions from the active rubric,
 * talk-track milestones, and standard bounded dimensions.
 */
export function buildClefQuestionsForRubric(
  methodology: SalesMethodology,
  script?: SalesScript | null,
  coachContext?: string
): Record<string, ClefQuestion> {
  const questions: Record<string, ClefQuestion> = {};

  // 1. Methodology Pillars (ordered 0-9 score)
  for (const pillar of methodology.pillars) {
    const managerNote = coachContext?.trim() ? ` Incorporate manager directives: ${coachContext.trim()}` : "";
    questions[pillar.key] = {
      type: "score",
      instructions: `Score the representative's qualification on '${pillar.label}' using the 0-9 scale. Criteria: ${pillar.rubric}.${managerNote}`,
      criteria: CLEF_SCORE_CRITERIA_0_TO_9,
    };
  }

  // 2. Script adherence
  if (script) {
    questions.scriptAdherence = {
      type: "score",
      instructions: `Score adherence to the prescribed talk track '${script.title}' (Milestones: ${script.keyMilestones.join("; ")}) using the 0-9 rubric. 0 means completely ignored or abandoned, 9 means all milestones hit cleanly.`,
      criteria: CLEF_SCORE_CRITERIA_0_TO_9,
    };
  } else {
    questions.scriptAdherence = {
      type: "score",
      instructions: `Score overall call flow, structure, and pacing adherence using the 0-9 rubric.`,
      criteria: CLEF_SCORE_CRITERIA_0_TO_9,
    };
  }

  // 3. Core Scorecard Dimensions (0-9 scores)
  questions.fightForTheWin = {
    type: "score",
    instructions: `Score 'Fight for the Win' / objection resistance on the 0-9 rubric. 0 means folded immediately on soft brush-offs ('send an email'), 9 means held frame respectfully and bought the next minute.`,
    criteria: CLEF_SCORE_CRITERIA_0_TO_9,
  };

  questions.nextStep = {
    type: "score",
    instructions: `Score 'Next-step firmness' on the 0-9 rubric. 0 means vague or no follow-up, 5 means soft demo interest with no calendar lock, 7-9 means locked calendar date and time.`,
    criteria: CLEF_SCORE_CRITERIA_0_TO_9,
  };

  questions.discoveryDepth = {
    type: "score",
    instructions: `Score 'Discovery depth' on the 0-9 rubric. Rate diagnostic probing and open questions vs premature pitching.`,
    criteria: CLEF_SCORE_CRITERIA_0_TO_9,
  };

  questions.controlAndPacing = {
    type: "score",
    instructions: `Score 'Control & pacing' on the 0-9 rubric. Rate who drove the conversation agenda and timeframe.`,
    criteria: CLEF_SCORE_CRITERIA_0_TO_9,
  };

  questions.peerAuthority = {
    type: "score",
    instructions: `Score 'Peer authority' on the 0-9 rubric. 0-3 means subservient/vendor order-taker tone, 7-9 means trusted peer advisor posture.`,
    criteria: CLEF_SCORE_CRITERIA_0_TO_9,
  };

  // 4. Configured Methodology Micro-Skills
  for (const skill of methodology.microSkills || []) {
    questions[skill.key] = {
      type: "score",
      instructions: `Score execution of '${skill.label}' on the 0-9 rubric. Rubric: ${skill.rubric}`,
      criteria: CLEF_SCORE_CRITERIA_0_TO_9,
    };
  }

  // 5. Bounded questions for high-precision decisioning
  questions.early_fold = {
    type: "noul",
    instructions: `Did the sales representative fold early by surrendering to a brush-off or soft objection (e.g. agreeing to 'send me an email', saying 'no problem, have a good day', or ending without testing fit)?`,
  };

  questions.clear_next_step = {
    type: "noul",
    instructions: `Did the call conclude with a clear, firm next step locked with a specific agreed date and time on the calendar?`,
  };

  questions.buyer_engaged = {
    type: "score",
    instructions: `Rate the buyer's level of engagement, responsiveness, and openness to dialogue on the 0-9 rubric.`,
    criteria: CLEF_SCORE_CRITERIA_0_TO_9,
  };

  questions.qualification_pain = {
    type: "score",
    instructions: `Rate customer pain qualification on the 0-9 rubric.`,
    criteria: CLEF_SCORE_CRITERIA_0_TO_9,
  };

  questions.qualification_budget = {
    type: "score",
    instructions: `Rate customer budget/resource qualification on the 0-9 rubric.`,
    criteria: CLEF_SCORE_CRITERIA_0_TO_9,
  };

  questions.qualification_decision = {
    type: "score",
    instructions: `Rate decision process/authority qualification on the 0-9 rubric.`,
    criteria: CLEF_SCORE_CRITERIA_0_TO_9,
  };

  questions.objection_handling = {
    type: "score",
    instructions: `Rate the representative's objection handling and pushback resilience on the 0-9 rubric.`,
    criteria: CLEF_SCORE_CRITERIA_0_TO_9,
  };

  questions.discovery_depth = {
    type: "score",
    instructions: `Rate diagnostic discovery depth and problem exploration on the 0-9 rubric.`,
    criteria: CLEF_SCORE_CRITERIA_0_TO_9,
  };

  return questions;
}

export interface ClefScorecardOutput {
  scorecard: ScorecardMetric[];
  sandlerBreakdown: CallEvaluation["sandlerBreakdown"];
  foldedEarly: boolean;
  clearNextStep: boolean;
  clefMetadata: ClefDecisionMetadata;
  rawAnswers: Record<string, ClefAnswer>;
}

/**
 * Maps Clef answers into structured scorecard metrics and breakdown slots,
 * deriving statuses deterministically from scores and preserving probability data.
 */
export function mapClefAnswersToScorecard(
  answers: Record<string, ClefAnswer>,
  methodology: SalesMethodology,
  clefResult: ClefDecisionResult
): ClefScorecardOutput {
  const scorecard: ScorecardMetric[] = [];
  const probabilitiesMap: Record<string, Record<string, number>> = {};
  let overallConfidenceScore = 0;
  let metricCount = 0;
  let hasNeedsReview = false;

  const extractScoreAndProbs = (key: string, defaultScore = 5) => {
    const ans = answers[key];
    if (!ans) {
      return { score: defaultScore, probs: {}, conf: 0.5, needsReview: false };
    }
    const assessment = evaluateAnswerConfidence(ans);
    if (assessment.needsReview) hasNeedsReview = true;
    overallConfidenceScore += assessment.confidenceScore;
    metricCount++;

    if ("score" in ans && typeof ans.score === "number") {
      const clampedScore = Math.max(0, Math.min(10, Math.round((ans.score / 9) * 100) / 10));
      return {
        score: clampedScore,
        probs: ans.probabilities || {},
        conf: assessment.confidenceScore,
        needsReview: assessment.needsReview,
      };
    }
    return {
      score: defaultScore,
      probs: ("probabilities" in ans ? ans.probabilities : {}) || {},
      conf: assessment.confidenceScore,
      needsReview: assessment.needsReview,
    };
  };

  // 1. Methodology Pillars
  for (const pillar of methodology.pillars) {
    const { score, probs, conf, needsReview } = extractScoreAndProbs(pillar.key);
    probabilitiesMap[pillar.key] = probs;
    scorecard.push({
      key: pillar.key,
      label: pillar.label,
      status: statusFromClefScore(score),
      score: Math.round(score),
      evidence: `Assessed by Clef decision model (${score.toFixed(1)}/10, confidence: ${conf.toFixed(2)}).`,
      probabilities: probs,
      confidence: conf,
      needsReview,
    });
  }

  // 2. Standard Scorecard Keys
  for (const key of SCORECARD_KEYS) {
    if (scorecard.some((m) => m.key === key)) continue;
    const { score, probs, conf, needsReview } = extractScoreAndProbs(key);
    probabilitiesMap[key] = probs;
    scorecard.push({
      key,
      label: SCORECARD_LABELS[key] || key,
      status: statusFromClefScore(score),
      score: Math.round(score),
      evidence: `Assessed by Clef decision model (${score.toFixed(1)}/10, confidence: ${conf.toFixed(2)}).`,
      probabilities: probs,
      confidence: conf,
      needsReview,
    });
  }

  // 3. Methodology Micro-Skills
  for (const skill of methodology.microSkills || []) {
    if (scorecard.some((m) => m.key === skill.key)) continue;
    const { score, probs, conf, needsReview } = extractScoreAndProbs(skill.key);
    probabilitiesMap[skill.key] = probs;
    scorecard.push({
      key: skill.key,
      label: skill.label,
      status: statusFromClefScore(score),
      score: Math.round(score),
      evidence: `Assessed by Clef decision model (${score.toFixed(1)}/10, confidence: ${conf.toFixed(2)}).`,
      probabilities: probs,
      confidence: conf,
      needsReview,
    });
  }

  // Extract bounded answers
  const earlyFoldAns = answers.early_fold;
  const earlyFoldProb =
    earlyFoldAns && "noul" in earlyFoldAns && typeof earlyFoldAns.noul === "number"
      ? earlyFoldAns.noul
      : 0.0;
  const foldedEarly = earlyFoldProb >= 0.5;

  const clearNextStepAns = answers.clear_next_step;
  const clearNextStepProb =
    clearNextStepAns && "noul" in clearNextStepAns && typeof clearNextStepAns.noul === "number"
      ? clearNextStepAns.noul
      : 0.0;
  const clearNextStep = clearNextStepProb >= 0.5;

  // Script adherence
  const scriptScoreData = extractScoreAndProbs("scriptAdherence", 6);
  const scriptScore = Math.max(1, Math.min(10, Math.round(scriptScoreData.score)));

  // Build sandlerBreakdown
  const getSlot = (key: string, label: string) => {
    const metric = scorecard.find((m) => m.key === key);
    return {
      status: metric?.status || "Incomplete",
      evidence: metric?.evidence || `Clef scored ${label}.`,
    };
  };

  const sandlerBreakdown: CallEvaluation["sandlerBreakdown"] = {
    pain: getSlot("pain", "Pain"),
    budget: getSlot("budget", "Budget"),
    decision: getSlot("decision", "Decision"),
    scriptAdherence: {
      score: scriptScore,
      feedback: `Script adherence scored at ${scriptScore}/10 by Clef decision model (confidence: ${scriptScoreData.conf.toFixed(2)}).`,
    },
  };

  const avgConfidence = metricCount > 0 ? overallConfidenceScore / metricCount : 0.5;
  const confidenceLevel: "high" | "medium" | "low" =
    avgConfidence >= 0.7 && !hasNeedsReview ? "high" : avgConfidence >= 0.45 ? "medium" : "low";

  const clefMetadata: ClefDecisionMetadata = {
    model: clefResult.model || CLEF_PRIMARY_MODEL,
    schemaVersion: CLEF_DECISION_SCHEMA_VERSION,
    timestamp: clefResult.timestamp || new Date().toISOString(),
    confidence: confidenceLevel,
    needsReview: hasNeedsReview,
    latencyMs: clefResult.latencyMs,
    mode: "primary",
    probabilities: probabilitiesMap,
    answers,
  };

  return {
    scorecard,
    sandlerBreakdown,
    foldedEarly,
    clearNextStep,
    clefMetadata,
    rawAnswers: answers,
  };
}

/**
 * Generates deterministic prose when a generative LLM is unavailable or disabled.
 */
export function generateDeterministicProse(input: {
  input: ClefEvaluationStateInput;
  scorecardOutput: ClefScorecardOutput;
  repName: string;
}): {
  bottomLine: string;
  topFixes: [PriorityFix, PriorityFix];
  coachingBrief: CoachingBrief;
  walkthrough: CoachWalkthroughStep[];
  scriptDivergence?: ScriptDivergence;
  coreOutcome: string;
} {
  const { input: evalInput, scorecardOutput, repName } = input;
  const { scorecard, sandlerBreakdown, foldedEarly } = scorecardOutput;

  // Outcome
  const coreOutcome = scorecardOutput.clearNextStep
    ? "Meeting booked"
    : classifyCoreOutcomeFromTranscript(evalInput.transcriptText);

  // Bottom Line
  const weakMetrics = scorecard.filter((m) => m.status === "Fail");
  const strongMetrics = scorecard.filter((m) => m.status === "Pass");
  const summaryPart = weakMetrics.length
    ? `Flagged gaps in ${weakMetrics.map((m) => m.label).join(", ")}.`
    : `Solid execution across measured dimensions.`;
  const foldPart = foldedEarly
    ? " The rep folded early on pushback instead of defending the frame."
    : " Handled objections without premature surrender.";

  const bottomLine = `${repName} completed a ${evalInput.callStage} call. ${summaryPart}${foldPart} Overall script adherence evaluated at ${sandlerBreakdown.scriptAdherence.score}/10.`;

  // Top Fixes
  const fixes: [PriorityFix, PriorityFix] = [
    {
      title: foldedEarly
        ? "Hold Frame on Soft Pushback"
        : weakMetrics[0]
          ? `Reinforce ${weakMetrics[0].label}`
          : "Tighten Qualification Thresholds",
      description: foldedEarly
        ? "When the prospect pushes back or asks for an email, do not immediately surrender. Acknowledge and ask one provocative calibration question to test fit."
        : weakMetrics[0]
          ? `Review criteria for ${weakMetrics[0].label} and ensure both business loss and personal stakes are anchored.`
          : "Nail down the exact decision criteria and budget bracket earlier in the sequence.",
    },
    {
      title: scorecardOutput.clearNextStep
        ? "Maintain High-Fidelity Next Steps"
        : "Lock Concrete Calendar Next Steps",
      description: scorecardOutput.clearNextStep
        ? "Ensure the next call objective and stakeholder attendance are confirmed prior to hanging up."
        : "Always conclude with a firm date and time lock on the calendar rather than leaving follow-up open to email.",
    },
  ];

  // Coaching Brief
  const coachingBrief = deriveCoachingBrief({
    wins: strongMetrics.map((m) => `${m.label}: Scored ${m.score}/10 (${m.status}).`),
    gaps: weakMetrics.map((m) => `${m.label}: Scored ${m.score}/10 (${m.status}).`),
    drills: fixes.map((f) => `${f.title}. ${f.description}`),
  });

  // Script Divergence
  const scriptDivergence = computeScriptDivergence(
    evalInput.transcriptText,
    evalInput.script || null,
    sandlerBreakdown.scriptAdherence.score
  );

  // Walkthrough
  const missedOpportunities: MissedOpportunity[] = [];
  const walkthrough = buildWalkthroughFromTranscript(
    evalInput.transcriptText,
    evalInput.durationSeconds ?? 0,
    missedOpportunities,
    repName
  );

  return {
    bottomLine,
    topFixes: fixes,
    coachingBrief,
    walkthrough,
    scriptDivergence,
    coreOutcome: normalizeCoreOutcome(coreOutcome),
  };
}

/**
 * Invokes the generative LLM as an explanation and coaching layer for authoritative Clef scores.
 * The prompt strictly instructs the LLM not to alter scores or statuses, but only to explain
 * them using transcript quotes and surface uncertainty.
 */
export async function explainClefScorecardWithLlm(input: {
  stateInput: ClefEvaluationStateInput;
  scorecardOutput: ClefScorecardOutput;
  apiKey: string;
  providerId: any;
  model: string;
  baseUrl?: string | null;
}): Promise<{
  bottomLine: string;
  topFixes: [PriorityFix, PriorityFix];
  coachingBrief: CoachingBrief;
  scorecard: ScorecardMetric[];
  walkthrough: CoachWalkthroughStep[];
  scriptDivergence?: ScriptDivergence;
  coreOutcome: string;
  missedOpportunities: MissedOpportunity[];
  estimatedCostUsd?: number;
}> {
  const { stateInput, scorecardOutput, apiKey, providerId, model, baseUrl } = input;
  const { scorecard, sandlerBreakdown } = scorecardOutput;

  const scoreSummary = scorecard
    .map(
      (m) =>
        `- ${m.label} (${m.key}): Score ${m.score}/10 (${m.status})${
          m.needsReview ? " [UNCERTAINTY FLAG: Top probabilities close; cite evidence carefully]" : ""
        }`
    )
    .join("\n");

  const duration = stateInput.durationSeconds ?? 0;
  const turns = parseTranscript(stateInput.transcriptText, duration);
  const formattedTranscript = turns.length
    ? turns.map((t) => `[${t.timestamp}] ${t.speaker}: ${t.text}`).join("\n")
    : stateInput.transcriptText;

  const explanationPrompt = `
${EVIDENCE_POLICY}
You are the AI Sales Coach explanation layer.
The primary decision model (Cloudflare Clef) has ALREADY evaluated this call and returned the AUTHORITATIVE scores below.

=== AUTHORITATIVE CLEF SCORES (LOCKED — DO NOT CHANGE) ===
Script Adherence: ${sandlerBreakdown.scriptAdherence.score}/10
${scoreSummary}
Early Fold Detected: ${scorecardOutput.foldedEarly ? "YES" : "NO"}
Firm Next Step: ${scorecardOutput.clearNextStep ? "YES" : "NO"}
=== END AUTHORITATIVE SCORES ===

NON-NEGOTIABLE INSTRUCTIONS:
1. DO NOT RESCORE THE CALL.
2. DO NOT CHANGE CLEF'S METRIC SCORES OR PASS/INCOMPLETE/FAIL STATUSES.
3. YOUR SOLE TASK IS TO EXPLAIN AND CITE EVIDENCE:
   - For every metric on the scorecard, write 1-2 sentences explaining why Clef awarded that score using verbatim quotes and [m:ss] timestamps from the transcript.
   - For any metric marked with [UNCERTAINTY FLAG], explicitly mention that the evidence is ambiguous or borderline in your evidence note.
   - Write bottomLine (2-3 candid sentences citing at least one [m:ss] timestamp).
   - Write topFixes (two tactical corrections targeting the flagged misses).
   - Write coachingBrief (praiseReinforcement, tacticalGaps, remedialDrills).
   - Detail scriptDivergence and a sequential walkthrough citing the transcript.

Call Transcript:
${untrustedEvidence("Call transcript", formattedTranscript)}

Return valid JSON adhering to this schema:
${JSON.stringify({
  callTypeDetected: stateInput.callStage,
  coreOutcome: scorecardOutput.clearNextStep ? "Meeting booked" : "Dropped",
  bottomLine: "string",
  missedOpportunities: [
    {
      timestamp: "1:12",
      timestampSeconds: 72,
      prospectOpening: "string",
      prospectQuote: "string",
      repSurrender: "string",
      repQuote: "string",
      whatToSayInstead: "string",
    },
  ],
  scorecard: scorecard.map((m) => ({
    key: m.key,
    label: m.label,
    status: m.status,
    score: m.score,
    evidence: "Explanation citing [m:ss] and quote",
  })),
  walkthrough: [
    {
      step: 1,
      timestamp: "0:30",
      timestampSeconds: 30,
      speaker: "Rep",
      quote: "string",
      whatHappened: "string",
      shouldHaveDone: "string",
      verdict: "good",
      category: "Pain",
    },
  ],
  scriptDivergence: {
    scriptTitle: stateInput.script?.title || "Framework",
    milestones: [{ milestone: "Milestone", status: "Hit", note: "Evidence with timestamp" }],
  },
  topFixes: [
    { title: "Fix 1", description: "Details with timestamp" },
    { title: "Fix 2", description: "Details with timestamp" },
  ],
  coachingBrief: {
    praiseReinforcement: "string",
    tacticalGaps: "string",
    remedialDrills: "string",
  },
})}
`;

  const result = await completeJson({
    providerId,
    apiKey,
    model,
    baseUrl,
    prompt: explanationPrompt,
    responseSchema: providerId === "gemini" ? EVALUATION_RESPONSE_SCHEMA : undefined,
  });

  const parsed = result.parsed || {};

  // Enrich scorecard evidence while strictly preserving Clef scores and statuses
  const enrichedScorecard = scorecard.map((originalMetric) => {
    const modelMetric = Array.isArray(parsed.scorecard)
      ? parsed.scorecard.find((m: any) => m.key === originalMetric.key)
      : null;
    return {
      ...originalMetric,
      evidence: modelMetric?.evidence || originalMetric.evidence,
      cite: modelMetric?.cite || originalMetric.cite,
    };
  });

  const topFixes: [PriorityFix, PriorityFix] = Array.isArray(parsed.topFixes) && parsed.topFixes.length >= 2
    ? [
        { title: String(parsed.topFixes[0]?.title || "Tighten next call"), description: String(parsed.topFixes[0]?.description || "") },
        { title: String(parsed.topFixes[1]?.title || "Lock next step"), description: String(parsed.topFixes[1]?.description || "") },
      ]
    : [
        { title: "Disarm Soft Brush-offs", description: "Buy the next 60 seconds with a diagnostic question." },
        { title: "Lock Next Step", description: "Lock a calendar date and time." },
      ];

  const coachingBrief: CoachingBrief = {
    praiseReinforcement: String(parsed.coachingBrief?.praiseReinforcement || "").trim() || "Good persistence in dialogue.",
    tacticalGaps: String(parsed.coachingBrief?.tacticalGaps || "").trim() || "Tighten objection handling.",
    remedialDrills: String(parsed.coachingBrief?.remedialDrills || "").trim() || "Practice objection reversal lines.",
  };

  const missedOpportunities: MissedOpportunity[] = Array.isArray(parsed.missedOpportunities)
    ? parsed.missedOpportunities
    : [];

  const walkthrough: CoachWalkthroughStep[] = Array.isArray(parsed.walkthrough) && parsed.walkthrough.length > 0
    ? parsed.walkthrough
    : buildWalkthroughFromTranscript(stateInput.transcriptText, duration, missedOpportunities, stateInput.repName);

  return {
    bottomLine: parsed.bottomLine || `Evaluated by Cloudflare Clef decision model.`,
    topFixes,
    coachingBrief,
    scorecard: enrichedScorecard,
    walkthrough,
    scriptDivergence: parsed.scriptDivergence,
    coreOutcome: normalizeCoreOutcome(parsed.coreOutcome || (scorecardOutput.clearNextStep ? "Meeting booked" : "Dropped")),
    missedOpportunities,
    estimatedCostUsd: result.estimatedCostUsd,
  };
}

export interface EvaluateWithClefOptions {
  callId: string;
  repId: string;
  repName: string;
  transcriptText: string;
  callStage: string;
  prospectCompany: string;
  prospectName: string;
  durationSeconds?: number;
  methodology: SalesMethodology;
  script?: SalesScript | null;
  coachContext?: string;
  aiSettings?: {
    apiKey: string | null;
    providerId: any;
    model: string;
    baseUrl?: string | null;
  };
  clefOptions?: {
    accountId?: string;
    apiToken?: string;
    timeoutMs?: number;
    aiBinding?: any;
  };
}

/**
 * Primary Clef Evaluation Pipeline:
 * transcript → Clef decisions → deterministic weighted score → optional LLM explanation
 */
export async function evaluateCallWithClef(
  options: EvaluateWithClefOptions
): Promise<Omit<CallEvaluation, "id" | "callId" | "repId" | "createdAt">> {
  const duration = options.durationSeconds ?? 0;

  // 1. Build Decision State containing ONLY required context (no keys, no weights)
  const stateInput: ClefEvaluationStateInput = {
    transcriptText: options.transcriptText,
    durationSeconds: duration,
    callStage: options.callStage,
    repName: options.repName,
    prospectCompany: options.prospectCompany,
    prospectName: options.prospectName,
    methodology: options.methodology,
    script: options.script,
    coachContext: options.coachContext,
  };
  const clefState = buildClefDecisionState(stateInput);

  // 2. Generate Typed Questions dynamically from active rubric
  const questions = buildClefQuestionsForRubric(
    options.methodology,
    options.script,
    options.coachContext
  );

  // 3. Dispatch to Clef Decision Provider (with automatic 64-question batching)
  const clefResult = await runClefDecisions(
    {
      state: clefState,
      questions,
    },
    options.clefOptions
  );

  // 4. Map Clef results to scorecard metrics and deterministic statuses
  const scorecardOutput = mapClefAnswersToScorecard(
    clefResult.answers,
    options.methodology,
    clefResult
  );

  // 5. Generate Evidence & Coaching (LLM explanation layer if available, else deterministic)
  let bottomLine: string;
  let topFixes: [PriorityFix, PriorityFix];
  let coachingBrief: CoachingBrief;
  let scorecard = scorecardOutput.scorecard;
  let walkthrough: CoachWalkthroughStep[];
  let scriptDivergence: ScriptDivergence | undefined;
  let coreOutcome: string;
  let missedOpportunities: MissedOpportunity[] = [];
  let evaluatedWith: EvaluatedWith = {
    provider: "clef",
    model: CLEF_PRIMARY_MODEL,
  };

  if (options.aiSettings?.apiKey) {
    try {
      const llmExplanation = await explainClefScorecardWithLlm({
        stateInput,
        scorecardOutput,
        apiKey: options.aiSettings.apiKey,
        providerId: options.aiSettings.providerId,
        model: options.aiSettings.model,
        baseUrl: options.aiSettings.baseUrl,
      });
      bottomLine = llmExplanation.bottomLine;
      topFixes = llmExplanation.topFixes;
      coachingBrief = llmExplanation.coachingBrief;
      scorecard = llmExplanation.scorecard;
      walkthrough = llmExplanation.walkthrough;
      scriptDivergence = llmExplanation.scriptDivergence;
      coreOutcome = llmExplanation.coreOutcome;
      missedOpportunities = llmExplanation.missedOpportunities;
      evaluatedWith = {
        provider: "clef",
        model: CLEF_PRIMARY_MODEL,
        estimatedCostUsd: llmExplanation.estimatedCostUsd,
      };
    } catch (llmErr) {
      console.warn("LLM explanation failed; using deterministic prose for Clef decisions:", llmErr);
      const deterministic = generateDeterministicProse({
        input: stateInput,
        scorecardOutput,
        repName: options.repName,
      });
      bottomLine = deterministic.bottomLine;
      topFixes = deterministic.topFixes;
      coachingBrief = deterministic.coachingBrief;
      walkthrough = deterministic.walkthrough;
      scriptDivergence = deterministic.scriptDivergence;
      coreOutcome = deterministic.coreOutcome;
    }
  } else {
    const deterministic = generateDeterministicProse({
      input: stateInput,
      scorecardOutput,
      repName: options.repName,
    });
    bottomLine = deterministic.bottomLine;
    topFixes = deterministic.topFixes;
    coachingBrief = deterministic.coachingBrief;
    walkthrough = deterministic.walkthrough;
    scriptDivergence = deterministic.scriptDivergence;
    coreOutcome = deterministic.coreOutcome;
  }

  // 6. Attach cites to scorecard metrics
  scorecard = attachCitesToScorecard(scorecard, options.transcriptText, duration);
  missedOpportunities = stampMissedOpportunities(
    missedOpportunities,
    options.transcriptText,
    duration
  );

  return {
    repName: options.repName,
    callTypeDetected: options.callStage as any,
    coreOutcome: normalizeCoreOutcome(coreOutcome),
    bottomLine,
    missedOpportunities,
    scriptDivergence,
    sandlerBreakdown: scorecardOutput.sandlerBreakdown,
    topFixes,
    scorecard,
    walkthrough,
    coachingBrief,
    debrief: scoreMethodDebrief(options.methodology, options.transcriptText, options.repName),
    evaluatedWith,
    rawMarkdown: `### Manager's Assessment for ${options.repName}\n${bottomLine}`,
  };
}

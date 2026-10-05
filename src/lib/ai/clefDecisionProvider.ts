import { revenueRuntime } from "../revenue/runtime";

export const CLEF_PRIMARY_MODEL = "@cf/cloudflare/clef";
export const CLEF_MODEL_FIELD = "clef";
export const CLEF_MAX_QUESTIONS_PER_BATCH = 64;
export const CLEF_DECISION_SCHEMA_VERSION = "1.0";

export type ClefQuestionType = "noul" | "choice" | "score";

export interface ClefNoulQuestion {
  type: "noul";
  instructions: string;
}

export interface ClefChoiceQuestion {
  type: "choice";
  instructions: string;
  criteria: Record<string, string>;
}

export interface ClefScoreQuestion {
  type: "score";
  instructions: string;
  criteria: string[];
}

export type ClefQuestion = ClefNoulQuestion | ClefChoiceQuestion | ClefScoreQuestion;

export interface ClefNoulAnswer {
  type?: "noul";
  noul: number; // Probability of yes (0.0 - 1.0)
  confidence?: number;
}

export interface ClefChoiceAnswer {
  type?: "choice";
  choice: string;
  probabilities: Record<string, number>;
  confidence?: number;
}

export interface ClefScoreAnswer {
  type?: "score";
  score: number; // Probability-weighted expected score
  probabilities: Record<string, number>;
  confidence?: number;
}

export type ClefAnswer = ClefNoulAnswer | ClefChoiceAnswer | ClefScoreAnswer;

export interface ClefDecisionPayload {
  model?: string;
  state: string;
  questions: Record<string, ClefQuestion>;
}

export interface ClefDecisionResult {
  model: string;
  schemaVersion: string;
  timestamp: string;
  answers: Record<string, ClefAnswer>;
  latencyMs: number;
  batchesExecuted: number;
}

export interface ClefProviderOptions {
  accountId?: string;
  apiToken?: string;
  timeoutMs?: number;
  aiBinding?: any;
}

export interface ClefConfidenceConfig {
  highThreshold: number;
  mediumThreshold: number;
  closeMargin: number;
}

export const DEFAULT_CONFIDENCE_CONFIG: ClefConfidenceConfig = {
  highThreshold: 0.70,
  mediumThreshold: 0.45,
  closeMargin: 0.10,
};

export type DecisionConfidenceLevel = "high" | "medium" | "low";

export interface DecisionConfidenceAssessment {
  level: DecisionConfidenceLevel;
  confidenceScore: number;
  needsReview: boolean;
  reason?: string;
}

export class ClefError extends Error {
  constructor(message: string, public readonly code: string, public readonly details?: unknown) {
    super(message);
    this.name = "ClefError";
  }
}

export class ClefTimeoutError extends ClefError {
  constructor(timeoutMs: number) {
    super(`Clef decision request timed out after ${timeoutMs}ms`, "TIMEOUT");
    this.name = "ClefTimeoutError";
  }
}

export class ClefMalformedResponseError extends ClefError {
  constructor(message: string, details?: unknown) {
    super(`Malformed Clef response: ${message}`, "MALFORMED_RESPONSE", details);
    this.name = "ClefMalformedResponseError";
  }
}

export class ClefConfigurationError extends ClefError {
  constructor(message: string) {
    super(`Clef configuration error: ${message}`, "CONFIG_ERROR");
    this.name = "ClefConfigurationError";
  }
}

/**
 * Assess confidence and determine whether a human review is advised.
 * High confidence: top prob >= highThreshold and clear margin.
 * Medium confidence: acceptable, accepted automatically but flagged internally.
 * Low confidence / close top probabilities: marked needs_review.
 */
export function evaluateAnswerConfidence(
  answer: ClefAnswer,
  config: ClefConfidenceConfig = DEFAULT_CONFIDENCE_CONFIG
): DecisionConfidenceAssessment {
  if ("noul" in answer && typeof answer.noul === "number") {
    const p = answer.noul;
    const distance = Math.abs(p - 0.5);
    const score = Math.min(1, Math.max(0, distance * 2));

    if (distance < config.closeMargin) {
      return {
        level: "low",
        confidenceScore: score,
        needsReview: true,
        reason: `Probability near 0.5 threshold (${p.toFixed(2)})`,
      };
    }
    if (score >= config.highThreshold) {
      return { level: "high", confidenceScore: score, needsReview: false };
    }
    if (score >= config.mediumThreshold) {
      return { level: "medium", confidenceScore: score, needsReview: false };
    }
    return {
      level: "low",
      confidenceScore: score,
      needsReview: true,
      reason: `Moderate confidence on binary decision (${p.toFixed(2)})`,
    };
  }

  // Score or choice answer with probabilities
  const probs = ("probabilities" in answer ? answer.probabilities : undefined) || {};
  const values = Object.values(probs).filter((v): v is number => typeof v === "number");

  if (values.length > 0) {
    const sorted = [...values].sort((a, b) => b - a);
    const top1 = sorted[0];
    const top2 = sorted[1] ?? 0;
    const margin = top1 - top2;

    if (values.length > 1 && margin < config.closeMargin) {
      return {
        level: "low",
        confidenceScore: top1,
        needsReview: true,
        reason: `Close top probabilities (${top1.toFixed(2)} vs ${top2.toFixed(2)})`,
      };
    }
    if (top1 >= config.highThreshold) {
      return { level: "high", confidenceScore: top1, needsReview: false };
    }
    if (top1 >= config.mediumThreshold) {
      return { level: "medium", confidenceScore: top1, needsReview: false };
    }
    return {
      level: "low",
      confidenceScore: top1,
      needsReview: true,
      reason: `Top probability below threshold (${top1.toFixed(2)})`,
    };
  }

  // If the model reported confidence directly
  if (typeof answer.confidence === "number") {
    const conf = answer.confidence;
    if (conf >= config.highThreshold) {
      return { level: "high", confidenceScore: conf, needsReview: false };
    }
    if (conf >= config.mediumThreshold) {
      return { level: "medium", confidenceScore: conf, needsReview: false };
    }
    return {
      level: "low",
      confidenceScore: conf,
      needsReview: true,
      reason: `Reported confidence below threshold (${conf.toFixed(2)})`,
    };
  }

  return { level: "medium", confidenceScore: 0.5, needsReview: false };
}

/**
 * Normalizes raw Clef answer objects into typed ClefAnswer records.
 */
function normalizeRawClefAnswer(questionId: string, raw: unknown, question?: ClefQuestion): ClefAnswer {
  if (!raw || typeof raw !== "object") {
    if (typeof raw === "number") {
      if (question?.type === "noul") {
        return { type: "noul", noul: raw, confidence: Math.abs(raw - 0.5) * 2 };
      }
      return { type: "score", score: raw, probabilities: { [String(Math.round(raw))]: 1.0 }, confidence: 1.0 };
    }
    throw new ClefMalformedResponseError(`Invalid answer format for question '${questionId}'`, raw);
  }

  const obj = raw as Record<string, unknown>;

  // Check noul
  if ("noul" in obj && typeof obj.noul === "number") {
    return {
      type: "noul",
      noul: obj.noul,
      confidence: typeof obj.confidence === "number" ? obj.confidence : Math.abs(obj.noul - 0.5) * 2,
    };
  }

  // Check score
  if ("score" in obj && typeof obj.score === "number") {
    const probabilities: Record<string, number> = {};
    if (obj.probabilities && typeof obj.probabilities === "object") {
      for (const [k, v] of Object.entries(obj.probabilities as Record<string, unknown>)) {
        if (typeof v === "number") probabilities[k] = v;
      }
    }
    return {
      type: "score",
      score: obj.score,
      probabilities,
      confidence: typeof obj.confidence === "number" ? obj.confidence : undefined,
    };
  }

  // Check choice
  if ("choice" in obj && typeof obj.choice === "string") {
    const probabilities: Record<string, number> = {};
    if (obj.probabilities && typeof obj.probabilities === "object") {
      for (const [k, v] of Object.entries(obj.probabilities as Record<string, unknown>)) {
        if (typeof v === "number") probabilities[k] = v;
      }
    }
    return {
      type: "choice",
      choice: obj.choice,
      probabilities,
      confidence: typeof obj.confidence === "number" ? obj.confidence : undefined,
    };
  }

  // Infer from question type if fields are present
  if (question?.type === "score") {
    if (typeof obj.value !== "number") throw new ClefMalformedResponseError(`Missing score for question '${questionId}'`);
    const scoreVal = obj.value;
    return {
      type: "score",
      score: scoreVal,
      probabilities: (obj.probabilities as Record<string, number>) || {},
      confidence: typeof obj.confidence === "number" ? obj.confidence : undefined,
    };
  }

  throw new ClefMalformedResponseError(`Unrecognized answer structure for question '${questionId}'`, raw);
}

export function normalizeClefAnswer(questionId: string, raw: unknown, question?: ClefQuestion): ClefAnswer {
  const answer = normalizeRawClefAnswer(questionId, raw, question);
  const probability = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
  const malformed = () => { throw new ClefMalformedResponseError(`Invalid bounded answer for question '${questionId}'`); };
  if (question && answer.type !== question.type) malformed();
  if (answer.confidence !== undefined && !probability(answer.confidence)) malformed();
  if ("noul" in answer && !probability(answer.noul)) malformed();
  if ("score" in answer && (!Number.isFinite(answer.score) || answer.score < 0 || answer.score > 10)) malformed();
  if ("probabilities" in answer && Object.values(answer.probabilities).some(value => !probability(value))) malformed();
  if ("choice" in answer && question?.type === "choice" && !Object.hasOwn(question.criteria, answer.choice)) malformed();
  return answer;
}

/**
 * Attempts to locate the Workers AI binding if running on Cloudflare.
 */
function resolveWorkersAiBinding(explicitBinding?: any): any {
  if (explicitBinding) return explicitBinding;
  try {
    const { getCloudflareContext } = require("@opennextjs/cloudflare");
    const ctx = getCloudflareContext();
    if (ctx?.env?.AI) return ctx.env.AI;
  } catch {
    // OpenNext context not present in tests or Node runtime
  }
  try {
    const runtime = revenueRuntime();
    if (runtime?.env?.AI) return runtime.env.AI;
  } catch {
    // Runtime env not configured
  }
  return null;
}

/**
 * Dispatches a single batch of up to 64 questions to Clef.
 */
async function executeSingleBatch(
  payload: { state: string; questions: Record<string, ClefQuestion> },
  options: ClefProviderOptions = {}
): Promise<Record<string, ClefAnswer>> {
  const timeoutMs = options.timeoutMs ?? 30000;
  const aiBinding = resolveWorkersAiBinding(options.aiBinding);

  // 1. Prefer Workers AI binding when available
  if (aiBinding && typeof aiBinding.run === "function") {
    let resultPromise = aiBinding.run(CLEF_PRIMARY_MODEL, {
      model: CLEF_MODEL_FIELD,
      state: payload.state,
      questions: payload.questions,
    });

    let timer: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new ClefTimeoutError(timeoutMs)), timeoutMs);
    });

    try {
      const response = await Promise.race([resultPromise, timeoutPromise]);
      const resData = response?.result || response;
      const rawAnswers = resData?.answers;

      if (!rawAnswers || typeof rawAnswers !== "object") {
        throw new ClefMalformedResponseError("Missing 'answers' map in binding response", response);
      }

      const answers: Record<string, ClefAnswer> = {};
      for (const [key, qDef] of Object.entries(payload.questions)) {
        if (key in rawAnswers) {
          answers[key] = normalizeClefAnswer(key, rawAnswers[key], qDef);
        } else {
          throw new ClefMalformedResponseError(`Missing answer for question '${key}'`, rawAnswers);
        }
      }
      return answers;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  // 2. Fall back to Cloudflare REST API for non-Cloudflare/local execution
  const accountId =
    options.accountId ||
    process.env.CLOUDFLARE_ACCOUNT_ID ||
    (revenueRuntime().env?.CLOUDFLARE_ACCOUNT_ID as string | undefined);
  const apiToken =
    options.apiToken ||
    process.env.CLOUDFLARE_API_TOKEN ||
    (revenueRuntime().env?.CLOUDFLARE_API_TOKEN as string | undefined);

  if (!accountId || !apiToken) {
    throw new ClefConfigurationError(
      "Cloudflare Workers AI credentials missing: provide AI binding or CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN"
    );
  }

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${CLEF_PRIMARY_MODEL}`;

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify({
        model: CLEF_MODEL_FIELD,
        state: payload.state,
        questions: payload.questions,
      }),
    });
  } catch (err: any) {
    if (err?.name === "TimeoutError" || err?.name === "AbortError") {
      throw new ClefTimeoutError(timeoutMs);
    }
    throw new ClefError(`Clef network request failed: ${err?.message || String(err)}`, "NETWORK_ERROR", err);
  }

  let body: any;
  try {
    body = await res.json();
  } catch (err) {
    throw new ClefMalformedResponseError(`Non-JSON response from Clef API (status ${res.status})`, err);
  }

  if (!res.ok || body?.success === false) {
    const errorMsg =
      body?.errors?.[0]?.message ||
      body?.messages?.[0] ||
      body?.error ||
      `Clef API request failed with status ${res.status}`;
    throw new ClefError(errorMsg, `HTTP_${res.status}`, body);
  }

  const resData = body?.result || body;
  const rawAnswers = resData?.answers;

  if (!rawAnswers || typeof rawAnswers !== "object") {
    throw new ClefMalformedResponseError("Missing 'answers' map in REST response", body);
  }

  const answers: Record<string, ClefAnswer> = {};
  for (const [key, qDef] of Object.entries(payload.questions)) {
    if (key in rawAnswers) {
      answers[key] = normalizeClefAnswer(key, rawAnswers[key], qDef);
    } else {
      throw new ClefMalformedResponseError(`Missing answer for question '${key}'`, rawAnswers);
    }
  }
  return answers;
}

/**
 * Splits questions deterministically into batches of at most 64 questions,
 * dispatches them via executeSingleBatch, and merges the results.
 */
export async function runClefDecisions(
  payload: ClefDecisionPayload,
  options: ClefProviderOptions = {}
): Promise<ClefDecisionResult> {
  const startTime = Date.now();
  const questionKeys = Object.keys(payload.questions);

  if (questionKeys.length === 0) {
    return {
      model: CLEF_PRIMARY_MODEL,
      schemaVersion: CLEF_DECISION_SCHEMA_VERSION,
      timestamp: new Date().toISOString(),
      answers: {},
      latencyMs: Date.now() - startTime,
      batchesExecuted: 0,
    };
  }

  // Chunk questions into deterministic batches of at most 64 questions
  const batches: Array<Record<string, ClefQuestion>> = [];
  for (let i = 0; i < questionKeys.length; i += CLEF_MAX_QUESTIONS_PER_BATCH) {
    const chunkKeys = questionKeys.slice(i, i + CLEF_MAX_QUESTIONS_PER_BATCH);
    const chunkQuestions: Record<string, ClefQuestion> = {};
    for (const key of chunkKeys) {
      chunkQuestions[key] = payload.questions[key];
    }
    batches.push(chunkQuestions);
  }

  // Run batches concurrently
  const batchResults = await Promise.all(
    batches.map((batch) => executeSingleBatch({ state: payload.state, questions: batch }, options))
  );

  // Merge all answers
  const mergedAnswers: Record<string, ClefAnswer> = {};
  for (const bResult of batchResults) {
    Object.assign(mergedAnswers, bResult);
  }

  return {
    model: CLEF_PRIMARY_MODEL,
    schemaVersion: CLEF_DECISION_SCHEMA_VERSION,
    timestamp: new Date().toISOString(),
    answers: mergedAnswers,
    latencyMs: Date.now() - startTime,
    batchesExecuted: batches.length,
  };
}

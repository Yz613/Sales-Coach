import { CORE_OUTCOMES } from "../coreOutcome";
import { SCORECARD_KEYS } from "./review";

/**
 * JSON Schema sent to Gemini as constrained decoding.
 * `responseMimeType: application/json` without a schema is only a hint, and
 * Gemini 3.8 Flash still returns objects with missing commas. A schema makes
 * the API emit syntactically valid JSON.
 */
const str = { type: "string" };
const num = { type: "number" };

const sandlerMetric = {
  type: "object",
  additionalProperties: false,
  required: ["status", "evidence"],
  properties: {
    status: { type: "string", enum: ["Pass", "Incomplete", "Fail"] },
    evidence: str,
  },
};

export const EVALUATION_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: [
    "callTypeDetected",
    "coreOutcome",
    "bottomLine",
    "missedOpportunities",
    "sandlerBreakdown",
    "scorecard",
    "walkthrough",
    "scriptDivergence",
    "topFixes",
  ],
  properties: {
    callTypeDetected: str,
    coreOutcome: { type: "string", enum: [...CORE_OUTCOMES] },
    bottomLine: str,
    missedOpportunities: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          timestamp: str,
          timestampSeconds: num,
          prospectOpening: str,
          prospectQuote: str,
          repSurrender: str,
          repQuote: str,
          whatToSayInstead: str,
        },
      },
    },
    sandlerBreakdown: {
      type: "object",
      additionalProperties: false,
      required: ["pain", "budget", "decision", "scriptAdherence"],
      properties: {
        pain: sandlerMetric,
        budget: sandlerMetric,
        decision: sandlerMetric,
        scriptAdherence: {
          type: "object",
          additionalProperties: false,
          required: ["score", "feedback"],
          properties: {
            score: num,
            feedback: str,
          },
        },
      },
    },
    scorecard: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["key", "label", "status", "score", "evidence"],
        properties: {
          key: { type: "string", enum: [...SCORECARD_KEYS] },
          label: str,
          status: { type: "string", enum: ["Pass", "Incomplete", "Fail"] },
          score: num,
          evidence: str,
          cite: {
            type: "object",
            additionalProperties: false,
            properties: {
              timestamp: str,
              timestampSeconds: num,
              quote: str,
            },
          },
        },
      },
    },
    walkthrough: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["step", "timestamp", "speaker", "quote", "whatHappened", "shouldHaveDone", "verdict", "category"],
        properties: {
          step: num,
          timestamp: str,
          timestampSeconds: num,
          speaker: str,
          quote: str,
          whatHappened: str,
          shouldHaveDone: str,
          verdict: { type: "string", enum: ["good", "coach", "miss", "fatal"] },
          category: str,
        },
      },
    },
    scriptDivergence: {
      type: "object",
      additionalProperties: false,
      required: ["scriptTitle", "milestones"],
      properties: {
        scriptTitle: str,
        milestones: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["milestone", "status", "note"],
            properties: {
              milestone: str,
              status: { type: "string", enum: ["Hit", "Partial", "Missed"] },
              note: str,
              timestamp: str,
              quote: str,
            },
          },
        },
      },
    },
    topFixes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "description"],
        properties: {
          title: str,
          description: str,
        },
      },
    },
  },
};

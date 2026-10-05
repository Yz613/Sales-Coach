import { db } from "../db";
import { calls, evaluations, scoreOverrides } from "../db/schema";
import { parseExtendedReview, type ScorecardMetric, type ShadowComparisonData } from "./review";
import { eq, and } from "drizzle-orm";
import { currentTenantId } from "../tenant";
import { weightedCallScore, weightsForMethod } from "../scoreWeights";
import { methodById } from "../salesMethods";

export interface ComparisonMetrics {
  totalEvaluations: number;
  totalComparisons: number;
  meanAbsoluteScoreDisagreement: number;
  passFailDisagreementRate: number; // 0.0 - 1.0
  managerOverrideCount: number;
  managerOverrideRate: number; // 0.0 - 1.0
  clefConfidenceDistribution: {
    high: number;
    medium: number;
    low: number;
    needsReviewRate: number;
  };
  latencyStatsMs: {
    min: number;
    median: number;
    p95: number;
    max: number;
    average: number;
  };
  failureRate: number; // 0.0 - 1.0
}

export interface EvaluationBenchmarkRecord {
  callId: string;
  orgId: string;
  callStage: string;
  transcriptText: string;
  timestamp: string;
  methodology: string;
  metricKey: string;
  metricLabel: string;
  clefDecision?: {
    model: string;
    score: number;
    status: string;
    confidence?: number;
    probabilities?: Record<string, number>;
    needsReview?: boolean;
  };
  legacyAiScore?: number;
  legacyAiStatus?: string;
  deterministicScore?: number;
  deterministicStatus?: string;
  managerCorrection?: {
    correctedScore: number;
    reason: string;
    authorName: string;
    correctedAt: string;
    originalScore?: number | null;
  };
  finalEffectiveScore: number;
  finalEffectiveStatus: string;
}

/**
 * Computes shadow comparison data between legacy AI evaluation, deterministic fallback, and Clef evaluation.
 */
export function buildShadowComparison(input: {
  legacyScorecard: ScorecardMetric[];
  legacyScriptScore: number;
  clefScorecard: ScorecardMetric[];
  clefScriptScore: number;
  deterministicScorecard: ScorecardMetric[];
  deterministicScriptScore: number;
  clefLatencyMs: number;
  clefModel: string;
  clefConfidence: "high" | "medium" | "low";
}): ShadowComparisonData {
  const method = methodById("sandler");
  const weights = weightsForMethod({}, method);

  const extractMetricMap = (scorecard: ScorecardMetric[], scriptScore: number) => {
    const scores: Record<string, number> = { scriptAdherence: scriptScore };
    for (const m of scorecard) scores[m.key] = m.score;
    return scores;
  };

  const legacyScores = extractMetricMap(input.legacyScorecard, input.legacyScriptScore);
  const clefScores = extractMetricMap(input.clefScorecard, input.clefScriptScore);
  const detScores = extractMetricMap(input.deterministicScorecard, input.deterministicScriptScore);

  const legacyTotal = weightedCallScore(legacyScores, weights, method) ?? 50;
  const clefTotal = weightedCallScore(clefScores, weights, method) ?? 50;
  const detTotal = weightedCallScore(detScores, weights, method) ?? 50;

  const statusDisagreements: string[] = [];
  const metricComparisons: ShadowComparisonData["metricComparisons"] = {};

  for (const clefMetric of input.clefScorecard) {
    const legacyMetric = input.legacyScorecard.find((m) => m.key === clefMetric.key);
    const legStatus = legacyMetric?.status || "Incomplete";
    if (clefMetric.status !== legStatus) {
      statusDisagreements.push(clefMetric.key);
    }
    metricComparisons[clefMetric.key] = {
      legacyScore: legacyMetric?.score ?? 5,
      legacyStatus: legStatus,
      clefScore: clefMetric.score,
      clefStatus: clefMetric.status,
      clefProbabilities: clefMetric.probabilities,
      clefConfidence: clefMetric.confidence,
      needsReview: clefMetric.needsReview,
    };
  }

  return {
    timestamp: new Date().toISOString(),
    legacyScore: legacyTotal,
    clefScore: clefTotal,
    deterministicScore: detTotal,
    disagreement: Math.abs(legacyTotal - clefTotal),
    statusDisagreements,
    clefConfidence: input.clefConfidence,
    clefLatencyMs: input.clefLatencyMs,
    clefModel: input.clefModel,
    metricComparisons,
  };
}

/**
 * Computes aggregate comparison metrics across all evaluations in the organization.
 */
export async function computeComparisonMetrics(orgId?: string): Promise<ComparisonMetrics> {
  const tenantId = orgId || currentTenantId();

  const evalRows = await db
    .select()
    .from(evaluations)
    .where(eq(evaluations.orgId, tenantId))
    .all();

  const overrideRows = await db
    .select()
    .from(scoreOverrides)
    .where(eq(scoreOverrides.orgId, tenantId))
    .all();

  let comparisonsCount = 0;
  let totalScoreDiff = 0;
  let totalStatusChecks = 0;
  let totalStatusDisagreements = 0;
  let failures = 0;
  const latencies: number[] = [];
  let highConf = 0;
  let medConf = 0;
  let lowConf = 0;
  let needsReviewCount = 0;

  for (const row of evalRows as any[]) {
    const extended = parseExtendedReview(row.extendedReview);
    if (extended?.evaluatedWith?.fallback === "rules" && extended?.evaluatedWith?.error) {
      failures++;
    }

    const shadow = extended?.shadowComparison;
    if (shadow) {
      comparisonsCount++;
      totalScoreDiff += shadow.disagreement;
      if (shadow.clefLatencyMs > 0) latencies.push(shadow.clefLatencyMs);

      if (shadow.clefConfidence === "high") highConf++;
      else if (shadow.clefConfidence === "medium") medConf++;
      else lowConf++;

      const metricKeys = Object.keys(shadow.metricComparisons || {});
      for (const k of metricKeys) {
        totalStatusChecks++;
        const cmp = shadow.metricComparisons[k];
        if (cmp.legacyStatus !== cmp.clefStatus) {
          totalStatusDisagreements++;
        }
        if (cmp.needsReview) {
          needsReviewCount++;
        }
      }
    } else if (extended?.clefMetadata) {
      // Direct Clef evaluation
      comparisonsCount++;
      if (extended.clefMetadata.latencyMs) latencies.push(extended.clefMetadata.latencyMs);
      if (extended.clefMetadata.confidence === "high") highConf++;
      else if (extended.clefMetadata.confidence === "medium") medConf++;
      else lowConf++;
      if (extended.clefMetadata.needsReview) needsReviewCount++;
    }
  }

  latencies.sort((a, b) => a - b);
  const minLatency = latencies[0] || 0;
  const maxLatency = latencies[latencies.length - 1] || 0;
  const medianLatency = latencies.length ? latencies[Math.floor(latencies.length / 2)] : 0;
  const p95Latency = latencies.length ? latencies[Math.floor(latencies.length * 0.95)] : 0;
  const avgLatency = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;

  const totalConfAssessed = highConf + medConf + lowConf || 1;
  const totalEvals = evalRows.length || 1;

  return {
    totalEvaluations: evalRows.length,
    totalComparisons: comparisonsCount,
    meanAbsoluteScoreDisagreement:
      comparisonsCount > 0 ? Math.round((totalScoreDiff / comparisonsCount) * 10) / 10 : 0,
    passFailDisagreementRate:
      totalStatusChecks > 0 ? Math.round((totalStatusDisagreements / totalStatusChecks) * 1000) / 1000 : 0,
    managerOverrideCount: overrideRows.length,
    managerOverrideRate: Math.round((overrideRows.length / (totalEvals * 8)) * 1000) / 1000,
    clefConfidenceDistribution: {
      high: Math.round((highConf / totalConfAssessed) * 1000) / 1000,
      medium: Math.round((medConf / totalConfAssessed) * 1000) / 1000,
      low: Math.round((lowConf / totalConfAssessed) * 1000) / 1000,
      needsReviewRate: comparisonsCount > 0 ? Math.round((needsReviewCount / comparisonsCount) * 1000) / 1000 : 0,
    },
    latencyStatsMs: {
      min: minLatency,
      median: medianLatency,
      p95: p95Latency,
      max: maxLatency,
      average: avgLatency,
    },
    failureRate: Math.round((failures / totalEvals) * 1000) / 1000,
  };
}

/**
 * Generates an exportable dataset for benchmarking and potential Clef fine-tuning.
 * Does NOT perform any training.
 */
export async function exportEvaluationDataset(options: {
  orgId?: string;
  format?: "json" | "jsonl";
} = {}): Promise<EvaluationBenchmarkRecord[] | string> {
  const tenantId = options.orgId || currentTenantId();

  const evalRows = await db
    .select()
    .from(evaluations)
    .where(eq(evaluations.orgId, tenantId))
    .all();

  const callRows = await db
    .select()
    .from(calls)
    .where(eq(calls.orgId, tenantId))
    .all();

  const overrideRows = await db
    .select()
    .from(scoreOverrides)
    .where(eq(scoreOverrides.orgId, tenantId))
    .all();

  const callMap = new Map((callRows as any[]).map((c: any) => [c.id, c]));
  const records: EvaluationBenchmarkRecord[] = [];

  for (const ev of evalRows as any[]) {
    const call = callMap.get(ev.callId);
    if (!call) continue;

    const extended = parseExtendedReview(ev.extendedReview);
    const shadow = extended?.shadowComparison;
    const clefMeta = extended?.clefMetadata;
    const callOverrides = (overrideRows as any[]).filter((o: any) => o.callId === ev.callId);

    const metrics = extended?.scorecard || [];
    for (const metric of metrics) {
      const override = callOverrides.find((o) => o.metricKey === metric.key);
      const cmp = shadow?.metricComparisons?.[metric.key];

      const record: EvaluationBenchmarkRecord = {
        callId: ev.callId,
        orgId: tenantId,
        callStage: call.callStage,
        transcriptText: call.transcriptText,
        timestamp: ev.createdAt,
        methodology: "Sandler",
        metricKey: metric.key,
        metricLabel: metric.label,
        clefDecision: {
          model: clefMeta?.model || shadow?.clefModel || "@cf/cloudflare/clef",
          score: cmp?.clefScore ?? metric.score,
          status: cmp?.clefStatus ?? metric.status,
          confidence: cmp?.clefConfidence ?? metric.confidence,
          probabilities: cmp?.clefProbabilities ?? metric.probabilities,
          needsReview: cmp?.needsReview ?? metric.needsReview,
        },
        legacyAiScore: cmp?.legacyScore,
        legacyAiStatus: cmp?.legacyStatus,
        deterministicScore: shadow?.deterministicScore,
        managerCorrection: override
          ? {
              correctedScore: override.score,
              reason: override.reason,
              authorName: override.authorName,
              correctedAt: override.updatedAt,
              originalScore: (override as any).originalScore ?? metric.score,
            }
          : undefined,
        finalEffectiveScore: override ? override.score : metric.score,
        finalEffectiveStatus: override
          ? override.score >= 7
            ? "Pass"
            : override.score >= 4
            ? "Incomplete"
            : "Fail"
          : metric.status,
      };

      records.push(record);
    }
  }

  if (options.format === "jsonl") {
    return records.map((r) => JSON.stringify(r)).join("\n");
  }
  return records;
}

/**
 * Formats comparison metrics into a clean human-readable report.
 */
export function formatComparisonReport(metrics: ComparisonMetrics): string {
  return `=== CLOUDFLARE CLEF EVALUATION COMPARISON REPORT ===
Total Call Reviews Analyzed: ${metrics.totalEvaluations}
Shadow / Dual Evaluated Calls: ${metrics.totalComparisons}

SCORE ALIGNMENT:
- Mean Absolute Score Difference (0–100 scale): ${metrics.meanAbsoluteScoreDisagreement.toFixed(1)} pts
- Pass/Partial/Fail Disagreement Rate: ${(metrics.passFailDisagreementRate * 100).toFixed(1)}%

MANAGER INTERVENTIONS:
- Total Manager Overrides: ${metrics.managerOverrideCount}
- Overall Manager Override Rate: ${(metrics.managerOverrideRate * 100).toFixed(2)}%

CLEF CONFIDENCE PROFILE:
- High Confidence: ${(metrics.clefConfidenceDistribution.high * 100).toFixed(1)}%
- Medium Confidence: ${(metrics.clefConfidenceDistribution.medium * 100).toFixed(1)}%
- Low Confidence: ${(metrics.clefConfidenceDistribution.low * 100).toFixed(1)}%
- Marked for Review (needs_review): ${(metrics.clefConfidenceDistribution.needsReviewRate * 100).toFixed(1)}%

PERFORMANCE & LATENCY:
- Min Latency: ${metrics.latencyStatsMs.min}ms
- Median Latency: ${metrics.latencyStatsMs.median}ms
- P95 Latency: ${metrics.latencyStatsMs.p95}ms
- Max Latency: ${metrics.latencyStatsMs.max}ms
- Average Latency: ${metrics.latencyStatsMs.average}ms
- Failure / Degraded Fallback Rate: ${(metrics.failureRate * 100).toFixed(2)}%
=====================================================`;
}

import { NextResponse } from "next/server";
import { evaluateCall } from "@/lib/ai/coach";
import { resolveAiSettings } from "@/lib/ai/settings";
import { usedLlmReview } from "@/lib/evaluations";
import { getVisibleCallById } from "@/lib/viewer-calls";
import { getServerAuth } from "@/lib/auth";
import { evaluationCreditsForDuration } from "@/lib/billing";
import { QuotaExceededError, assertEvaluationAllowed, recordEvaluationUsage } from "@/lib/billingQuota";

export const maxDuration = 120;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { call } = await getVisibleCallById(id);
    if (!call) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    const auth = await getServerAuth();
    const credits = evaluationCreditsForDuration(call.durationSeconds);
    await assertEvaluationAllowed(auth, credits);

    const evaluation = await evaluateCall({
      callId: call.id,
      repId: call.repId,
      transcriptText: call.transcriptText,
      callStage: call.callStage,
      prospectCompany: call.prospectCompany,
      prospectName: call.prospectName,
      durationSeconds: call.durationSeconds,
    });

    await recordEvaluationUsage(auth, credits);

    const ai = await resolveAiSettings();
    const usedLlm = usedLlmReview(evaluation);
    const providerError = evaluation.evaluatedWith?.error;
    const warning =
      ai.hasKey && !usedLlm
        ? providerError
          ? `The AI provider failed (${evaluation.evaluatedWith?.provider}/${evaluation.evaluatedWith?.model}): ${providerError}`
          : "The AI provider failed; this call was scored with the built-in rule engine."
        : !ai.hasKey
          ? "No API key configured; scored with the built-in rule engine."
          : undefined;

    return NextResponse.json({ success: true, evaluation, usedLlm, warning, creditsCharged: credits });
  } catch (err: any) {
    if (err instanceof QuotaExceededError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    const message = err?.message || "Failed to evaluate call";
    const blocked = /transcript|Gemini, OpenAI, or Groq/i.test(message);
    return NextResponse.json({ error: message }, { status: blocked ? 422 : 500 });
  }
}

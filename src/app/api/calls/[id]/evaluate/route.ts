import { NextResponse } from "next/server";
import { getCallById } from "@/lib/db/service";
import { evaluateCall } from "@/lib/ai/coach";
import { resolveAiSettings } from "@/lib/ai/settings";
import { usedLlmReview } from "@/lib/evaluations";

export const maxDuration = 120;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const call = await getCallById(id);
    if (!call) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    const evaluation = await evaluateCall({
      callId: call.id,
      repId: call.repId,
      transcriptText: call.transcriptText,
      callStage: call.callStage,
      prospectCompany: call.prospectCompany,
      prospectName: call.prospectName,
      durationSeconds: call.durationSeconds,
    });

    const ai = await resolveAiSettings();
    const usedLlm = usedLlmReview(evaluation);
    const warning =
      ai.hasKey && !usedLlm
        ? "The AI provider failed; this call was scored with the built-in rule engine."
        : !ai.hasKey
          ? "No API key configured; scored with the built-in rule engine."
          : undefined;

    return NextResponse.json({ success: true, evaluation, usedLlm, warning });
  } catch (err: any) {
    const message = err?.message || "Failed to evaluate call";
    const blocked = /transcript|Gemini, OpenAI, or Groq/i.test(message);
    return NextResponse.json({ error: message }, { status: blocked ? 422 : 500 });
  }
}

import { NextResponse } from "next/server";
import { evaluateCall } from "@/lib/ai/coach";
import { evaluationCreditsForDuration } from "@/lib/billing";
import { PaymentRequiredError, QuotaExceededError, assertEvaluationAllowed, recordEvaluationUsage } from "@/lib/billingQuota";
import { getOrCreateRep, insertCall } from "@/lib/db/service";
import { requireWorkspace, workspaceErrorResponse } from "@/lib/workspace";

// Future integration webhook for Fathom / Gong / Zoom.
// Authenticated so a random caller cannot write into another team's workspace.
export async function POST(req: Request) {
  try {
    const auth = await requireWorkspace();
    const payload = await req.json();

    const repEmail = payload?.user?.email || payload?.rep_email;
    const repId = await getOrCreateRep(
      undefined,
      payload?.user?.name || payload?.rep_name,
      "Sales Rep",
      repEmail
    );

    const transcript = payload?.transcript || payload?.text || "";
    if (!transcript) {
      return NextResponse.json({ received: true, note: "No transcript provided" });
    }

    const durationSeconds = payload?.duration || 1200;
    await assertEvaluationAllowed(auth, evaluationCreditsForDuration(durationSeconds));

    const callId = `fathom_${Date.now()}`;
    await insertCall({
      id: callId,
      repId,
      prospectCompany: payload?.company_name || "",
      prospectName: payload?.prospect_name || "Lead",
      callStage: payload?.stage || "First Discovery",
      coreOutcome: "Analyzing...",
      durationSeconds,
      transcriptText: transcript,
      audioUrl: payload?.recording_url || undefined,
      status: "analyzing",
      createdAt: new Date().toISOString(),
    });

    await evaluateCall({
      callId,
      repId,
      transcriptText: transcript,
      callStage: payload?.stage || "First Discovery",
      prospectCompany: payload?.company_name || "",
      prospectName: payload?.prospect_name || "Lead",
      durationSeconds,
    });

    await recordEvaluationUsage(auth, evaluationCreditsForDuration(durationSeconds));

    return NextResponse.json({ success: true, callId });
  } catch (err: any) {
    if (err instanceof PaymentRequiredError || err instanceof QuotaExceededError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    return workspaceErrorResponse(err);
  }
}

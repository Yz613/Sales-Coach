import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calls, reps } from "@/lib/db/schema";
import { evaluateCall } from "@/lib/ai/coach";
import { evaluationCreditsForDuration } from "@/lib/billing";
import { QuotaExceededError, assertEvaluationAllowed, recordEvaluationUsage } from "@/lib/billingQuota";
import { getServerAuth } from "@/lib/auth";

// Future integration webhook for Fathom / Gong / Zoom
export async function POST(req: Request) {
  try {
    const payload = await req.json();
    
    // Fathom webhook payload schema mapping
    const repEmail = payload?.user?.email || payload?.rep_email;
    const allReps = await db.select().from(reps).all();
    let rep = allReps.find((r: any) => r.email === repEmail);
    if (!rep) rep = allReps[0];

    const transcript = payload?.transcript || payload?.text || "";
    if (!transcript) {
      return NextResponse.json({ received: true, note: "No transcript provided" });
    }

    const durationSeconds = payload?.duration || 1200;
    const auth = await getServerAuth();
    await assertEvaluationAllowed(auth, evaluationCreditsForDuration(durationSeconds));

    const callId = `fathom_${Date.now()}`;
    await db.insert(calls).values({
      id: callId,
      repId: rep.id,
      prospectCompany: payload?.company_name || "",
      prospectName: payload?.prospect_name || "Lead",
      callStage: payload?.stage || "First Discovery",
      coreOutcome: "Analyzing...",
      durationSeconds,
      transcriptText: transcript,
      audioUrl: payload?.recording_url || undefined,
      status: "analyzing",
      createdAt: new Date().toISOString(),
    }).run();

    // Trigger AI Coach
    await evaluateCall({
      callId,
      repId: rep.id,
      transcriptText: transcript,
      callStage: payload?.stage || "First Discovery",
      prospectCompany: payload?.company_name || "",
      prospectName: payload?.prospect_name || "Lead",
      durationSeconds,
    });

    await recordEvaluationUsage(auth, evaluationCreditsForDuration(durationSeconds));

    return NextResponse.json({ success: true, callId });
  } catch (err: any) {
    if (err instanceof QuotaExceededError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

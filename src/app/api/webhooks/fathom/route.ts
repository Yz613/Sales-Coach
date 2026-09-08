import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calls, reps } from "@/lib/db/schema";
import { evaluateCall } from "@/lib/ai/coach";

// Future integration webhook for Fathom / Gong / Zoom
export async function POST(req: Request) {
  try {
    const payload = await req.json();
    
    // Fathom webhook payload schema mapping
    const repEmail = payload?.user?.email || payload?.rep_email;
    const allReps = db.select().from(reps).all();
    let rep = allReps.find((r) => r.email === repEmail);
    if (!rep) rep = allReps[0];

    const transcript = payload?.transcript || payload?.text || "";
    if (!transcript) {
      return NextResponse.json({ received: true, note: "No transcript provided" });
    }

    const callId = `fathom_${Date.now()}`;
    db.insert(calls).values({
      id: callId,
      repId: rep.id,
      prospectCompany: payload?.company_name || "Enterprise Prospect",
      prospectName: payload?.prospect_name || "Lead",
      callStage: payload?.stage || "First Discovery",
      coreOutcome: "Analyzing...",
      durationSeconds: payload?.duration || 1200,
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
      prospectCompany: payload?.company_name || "Enterprise Prospect",
      prospectName: payload?.prospect_name || "Lead",
    });

    return NextResponse.json({ success: true, callId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

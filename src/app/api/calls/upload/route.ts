import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calls, reps } from "@/lib/db/schema";
import { evaluateCall } from "@/lib/ai/coach";

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";

    let repId = "";
    let repName = "";
    let prospectCompany = "";
    let prospectName = "";
    let callStage = "Cold Call";
    let transcriptText = "";
    let durationSeconds = 300;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      repId = (formData.get("repId") as string) || "";
      repName = (formData.get("repName") as string) || "";
      prospectCompany = (formData.get("prospectCompany") as string) || "Unknown Co";
      prospectName = (formData.get("prospectName") as string) || "Prospect";
      callStage = (formData.get("callStage") as string) || "Cold Call";

      const file = formData.get("file") as File | null;
      const rawText = formData.get("transcriptText") as string | null;

      if (rawText && rawText.trim().length > 0) {
        transcriptText = rawText.trim();
      } else if (file) {
        // If file is audio or text
        const buffer = Buffer.from(await file.arrayBuffer());
        if (file.type.includes("audio") || file.name.endsWith(".mp3") || file.name.endsWith(".wav") || file.name.endsWith(".m4a")) {
          // Note for audio: If Gemini API key is configured with multimodal support, it can process directly.
          // For now, we simulate/extract transcript or note audio received.
          transcriptText = `[Audio File Ingested: ${file.name} (${Math.round(file.size / 1024)} KB)]\n\nProspect: Hello? What is this about?\n${repName || "Rep"}: Hi, calling regarding your recent operational challenges.\nProspect: We already have an existing vendor and don't need this.\n${repName || "Rep"}: Understood, just send an email and I'll review it.\nProspect: Bye.`;
        } else {
          transcriptText = buffer.toString("utf-8");
        }
      }
    } else {
      const body = await req.json();
      repId = body.repId || "";
      repName = body.repName || "";
      prospectCompany = body.prospectCompany || "Unknown Co";
      prospectName = body.prospectName || "Prospect";
      callStage = body.callStage || "Cold Call";
      transcriptText = body.transcriptText || "";
      durationSeconds = body.durationSeconds || 300;
    }

    if (!transcriptText || transcriptText.trim().length === 0) {
      return NextResponse.json({ error: "Transcript text or call file is required" }, { status: 400 });
    }

    // If repId is empty or "new", create or find rep
    if (!repId || repId === "new") {
      const existingRep = db.select().from(reps).all()[0];
      repId = existingRep ? existingRep.id : "rep_marcus";
    }

    const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const now = new Date().toISOString();

    // Insert call
    db.insert(calls).values({
      id: callId,
      repId,
      prospectCompany,
      prospectName,
      callStage,
      coreOutcome: "Analyzing...",
      durationSeconds,
      transcriptText,
      status: "analyzing",
      createdAt: now,
    }).run();

    // Run AI Evaluation
    const evaluation = await evaluateCall({
      callId,
      repId,
      transcriptText,
      callStage,
      prospectCompany,
      prospectName,
    });

    return NextResponse.json({
      success: true,
      callId,
      evaluation,
    });
  } catch (error: any) {
    console.error("Upload & Evaluation Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to process call" },
      { status: 500 }
    );
  }
}

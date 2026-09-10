import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calls } from "@/lib/db/schema";
import { evaluateCall } from "@/lib/ai/coach";
import { addCallStage, getOrCreateRep, setRepFocus } from "@/lib/db/service";
import { normalizeStageName } from "@/lib/callStages";
import { ingestCallFile } from "@/lib/ingestCallFile";
import { isAudioFile } from "@/lib/audio";
import { requireUsableTranscript } from "@/lib/transcript";
import { getTranscriptionStatus, resolveTranscriptionBackend } from "@/lib/ai/transcribe";
import { saveCallAudio } from "@/lib/callAudioStore";

export async function GET() {
  try {
    const status = await getTranscriptionStatus();
    return NextResponse.json(status);
  } catch (err: any) {
    return NextResponse.json({ canTranscribe: false, reason: err?.message || "Unavailable" }, { status: 200 });
  }
}

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";

    let repId = "";
    let repName = "";
    let repRole = "";
    let repFocus = "";
    let prospectCompany = "";
    let prospectName = "";
    let callStage = "Cold Call";
    let transcriptText = "";
    let durationSeconds = 300;
    let audioBytes: Uint8Array | undefined;
    let audioMimeType: string | undefined;
    let audioFileName: string | undefined;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      repId = (formData.get("repId") as string) || "";
      repName = (formData.get("repName") as string) || "";
      repRole = (formData.get("repRole") as string) || "";
      repFocus = (formData.get("repFocus") as string) || "";
      prospectCompany = (formData.get("prospectCompany") as string) || "Unknown Co";
      prospectName = (formData.get("prospectName") as string) || "Prospect";
      callStage = (formData.get("callStage") as string) || "Cold Call";

      const file = formData.get("file") as File | null;
      const rawText = formData.get("transcriptText") as string | null;

      if (rawText && rawText.trim().length > 0) {
        transcriptText = rawText.trim();
      } else if (file) {
        if (isAudioFile(file)) {
          await resolveTranscriptionBackend();
        }
        const ingested = await ingestCallFile(file);
        transcriptText = ingested.transcriptText;
        if (ingested.durationSeconds > 0) {
          durationSeconds = ingested.durationSeconds;
        }
        if (ingested.audioBytes?.byteLength) {
          audioBytes = ingested.audioBytes;
          audioMimeType = ingested.audioMimeType;
          audioFileName = ingested.audioFileName;
        }
      }
    } else {
      const body = await req.json();
      repId = body.repId || "";
      repName = body.repName || "";
      repRole = body.repRole || "";
      repFocus = body.repFocus || "";
      prospectCompany = body.prospectCompany || "Unknown Co";
      prospectName = body.prospectName || "Prospect";
      callStage = body.callStage || "Cold Call";
      transcriptText = body.transcriptText || "";
      durationSeconds = body.durationSeconds || 300;
    }

    try {
      transcriptText = requireUsableTranscript(transcriptText);
    } catch (err: any) {
      return NextResponse.json({ error: err?.message || "No usable transcript" }, { status: 422 });
    }

    callStage = normalizeStageName(callStage) || "Cold Call";
    try {
      await addCallStage(callStage);
    } catch {
      // Stage list is best-effort; the call still records whatever stage was chosen.
    }

    // Resolve the rep (creating one from the provided name when needed).
    repId = await getOrCreateRep(repId, repName, repRole);
    if (repFocus.trim()) {
      await setRepFocus(repId, repFocus);
    }

    const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const now = new Date().toISOString();
    const audioUrl = audioBytes
      ? saveCallAudio(callId, audioBytes, audioMimeType, audioFileName)
      : undefined;

    // Insert call
    await db.insert(calls).values({
      id: callId,
      repId,
      prospectCompany,
      prospectName,
      callStage,
      coreOutcome: "Analyzing...",
      durationSeconds,
      transcriptText,
      audioUrl,
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
      durationSeconds,
    });

    return NextResponse.json({
      success: true,
      callId,
      evaluation,
    });
  } catch (error: any) {
    console.error("Upload & Evaluation Error:", error);
    const message = error?.message || "Failed to process call";
    const blocked = /transcript|Gemini, OpenAI, or Groq/i.test(message);
    return NextResponse.json({ error: message }, { status: blocked ? 422 : 500 });
  }
}

import { NextResponse } from "next/server";
import { evaluateCall } from "@/lib/ai/coach";
import { addCallStage, insertCall, setRepFocus } from "@/lib/db/service";
import { normalizeStageName } from "@/lib/callStages";
import { ingestPeekedCallFile, peekCallFile } from "@/lib/ingestCallFile";
import { durationFromTranscript } from "@/lib/audio";
import { requireUsableTranscript } from "@/lib/transcript";
import { getTranscriptionStatus, resolveTranscriptionBackend } from "@/lib/ai/transcribe";
import { saveCallAudio } from "@/lib/callAudioStore";
import { resolveUploadRepId } from "@/lib/viewer-calls";
import { evaluationCreditsForDuration } from "@/lib/billing";
import {
  PaymentRequiredError,
  QuotaExceededError,
  assertEvaluationAllowed,
  recordEvaluationUsage,
  summarizeBilling,
  loadBillingAccount,
} from "@/lib/billingQuota";
import { requireWorkspace, workspaceErrorResponse } from "@/lib/workspace";

export async function GET() {
  try {
    const auth = await requireWorkspace();
    const status = await getTranscriptionStatus();
    const billing = summarizeBilling(await loadBillingAccount(auth));
    return NextResponse.json({ ...status, billing });
  } catch (err: any) {
    const gated = workspaceErrorResponse(err);
    if (gated.status !== 500) return gated;
    return NextResponse.json({ canTranscribe: false, reason: err?.message || "Unavailable" }, { status: 200 });
  }
}

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const auth = await requireWorkspace();
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
      prospectCompany = ((formData.get("prospectCompany") as string) || "").trim();
      prospectName = ((formData.get("prospectName") as string) || "").trim() || "Prospect";
      callStage = (formData.get("callStage") as string) || "Cold Call";

      const file = formData.get("file") as File | null;
      const rawText = formData.get("transcriptText") as string | null;

      if (rawText && rawText.trim().length > 0) {
        transcriptText = rawText.trim();
        const stamped = durationFromTranscript(transcriptText);
        if (stamped > 0) durationSeconds = stamped;
      } else if (file) {
        const peek = await peekCallFile(file);
        durationSeconds = peek.durationSeconds || durationSeconds;
        await assertEvaluationAllowed(auth, evaluationCreditsForDuration(durationSeconds));
        if (peek.isAudio) {
          await resolveTranscriptionBackend();
        }
        const ingested = await ingestPeekedCallFile(peek);
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
      prospectCompany = (body.prospectCompany || "").trim();
      prospectName = (body.prospectName || "").trim() || "Prospect";
      callStage = body.callStage || "Cold Call";
      transcriptText = body.transcriptText || "";
      durationSeconds = body.durationSeconds || 300;
    }

    try {
      transcriptText = requireUsableTranscript(transcriptText);
    } catch (err: any) {
      return NextResponse.json({ error: err?.message || "No usable transcript" }, { status: 422 });
    }

    const evalCredits = evaluationCreditsForDuration(durationSeconds);
    await assertEvaluationAllowed(auth, evalCredits);

    callStage = normalizeStageName(callStage) || "Cold Call";
    try {
      await addCallStage(callStage);
    } catch {
      // Stage list is best-effort; the call still records whatever stage was chosen.
    }

    // Members can only attach calls to themselves.
    repId = await resolveUploadRepId(auth, { repId, repName, repRole });
    if (repFocus.trim()) {
      await setRepFocus(repId, repFocus);
    }

    const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const now = new Date().toISOString();
    const audioUrl = audioBytes
      ? saveCallAudio(callId, audioBytes, audioMimeType, audioFileName)
      : undefined;

    // Insert call
    await insertCall({
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
    });

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

    await recordEvaluationUsage(auth, evalCredits);

    return NextResponse.json({
      success: true,
      callId,
      evaluation,
      creditsCharged: evalCredits,
    });
  } catch (error: any) {
    if (error instanceof PaymentRequiredError || error instanceof QuotaExceededError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    const gated = workspaceErrorResponse(error);
    if (gated.status !== 500) return gated;
    console.error("Upload & Evaluation Error:", error);
    const message = error?.message || "Failed to process call";
    const blocked = /transcript|Gemini, OpenAI, or Groq/i.test(message);
    return NextResponse.json({ error: message }, { status: blocked ? 422 : 500 });
  }
}

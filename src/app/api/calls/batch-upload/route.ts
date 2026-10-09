import { withWorkspaceApi } from "@/lib/workspace";
import { NextResponse } from "next/server";
import { evaluateCall } from "@/lib/ai/coach";
import { addCallStage, insertCall, setRepFocus, updateCallStatus } from "@/lib/db/service";
import { normalizeStageName } from "@/lib/callStages";
import { ingestPeekedCallFile, peekCallFile, type PeekedCallFile } from "@/lib/ingestCallFile";
import { batchTranscriptsFromCsv, MAX_BATCH_CALLS } from "@/lib/batchUpload";
import { SecurityPolicyError } from "@/lib/security-policy";
import { requireUsableTranscript } from "@/lib/transcript";
import { resolveTranscriptionBackend } from "@/lib/ai/transcribe";
import { saveCallAudio } from "@/lib/callAudioStore";
import { resolveUploadRepId } from "@/lib/viewer-calls";
import { evaluationCreditsForDuration } from "@/lib/billing";
import {
  PaymentRequiredError,
  QuotaExceededError,
  assertEvaluationAllowed,
  recordEvaluationUsage,
} from "@/lib/billingQuota";
import { requireWorkspace, workspaceErrorResponse } from "@/lib/workspace";

export const maxDuration = 300;

interface BatchItem {
  repId: string;
  prospectCompany: string;
  prospectName: string;
  callStage: string;
  transcriptText: string;
  durationSeconds?: number;
  audioBytes?: Uint8Array;
  audioMimeType?: string;
  audioFileName?: string;
}

async function POSTHandler(req: Request) {
  try {
    const auth = await requireWorkspace();

    const contentType = req.headers.get("content-type") || "";

    let itemsToProcess: BatchItem[] = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const entries = formData.getAll("files");
      if (entries.some((entry) => typeof entry === "string")) {
        throw new SecurityPolicyError("Batch uploads require files.", 400);
      }
      const files = entries as File[];
      if (files.length > MAX_BATCH_CALLS) return NextResponse.json({ error: "Upload at most 10 files per batch." }, { status: 413 });
      const field = (name: string) => {
        const value = formData.get(name);
        if (value != null && typeof value !== "string") throw new SecurityPolicyError(`Invalid ${name}.`, 400);
        return value || "";
      };
      const defaultRepId = field("defaultRepId");
      const defaultRepName = field("defaultRepName");
      const defaultRepRole = field("defaultRepRole");
      const defaultRepFocus = field("defaultRepFocus");
      const defaultStage = normalizeStageName(field("defaultStage")).slice(0, 60).trim() || "Cold Call";
      const prepared: { peek?: PeekedCallFile; items?: Omit<BatchItem, "repId">[] }[] = [];
      let pendingCredits = 0;
      let pendingCalls = 0;
      // Count every CSV record before resolving reps or paying for audio transcription.
      for (const file of files) {
        if (file.name.toLowerCase().endsWith(".csv")) {
          if (file.size > 25 * 1024 * 1024) throw new SecurityPolicyError("Each upload must be 25 MB or smaller.", 413);
          const content = await file.text();
          const items = batchTranscriptsFromCsv(content, file.name, defaultStage);
          prepared.push({ items });
          pendingCalls += items.length;
          pendingCredits += items.reduce((sum, item) => sum + evaluationCreditsForDuration(item.durationSeconds), 0);
        } else {
          const peek = await peekCallFile(file);
          if (!peek.isAudio) requireUsableTranscript(peek.transcriptText);
          prepared.push({ peek });
          pendingCalls++;
          pendingCredits += evaluationCreditsForDuration(peek.durationSeconds || 300);
        }
        if (pendingCalls > MAX_BATCH_CALLS) throw new SecurityPolicyError("Import at most 10 calls per batch.", 413);
      }
      if (!pendingCalls) throw new SecurityPolicyError("No calls provided for batch processing", 400);
      await assertEvaluationAllowed(auth, pendingCredits);
      if (prepared.some((file) => file.peek?.isAudio)) await resolveTranscriptionBackend();

      try {
        await addCallStage(defaultStage);
      } catch {
        // Stage list is best-effort.
      }

      const resolvedRepId = await resolveUploadRepId(auth, {
        repId: defaultRepId,
        repName: defaultRepName,
        repRole: defaultRepRole,
      });
      if (defaultRepFocus.trim()) {
        await setRepFocus(resolvedRepId, defaultRepFocus);
      }

      for (const file of prepared) {
        if (file.items) {
          itemsToProcess.push(...file.items.map((item) => ({ ...item, repId: resolvedRepId })));
          continue;
        }
        const peek = file.peek!;
        const ingested = await ingestPeekedCallFile(peek);
        itemsToProcess.push({
          repId: resolvedRepId,
          prospectCompany: "",
          prospectName: peek.fileName.replace(/\.[^/.]+$/, "") || "Lead",
          callStage: defaultStage,
          transcriptText: requireUsableTranscript(ingested.transcriptText),
          durationSeconds: ingested.durationSeconds || 300,
          audioBytes: ingested.audioBytes,
          audioMimeType: ingested.audioMimeType,
          audioFileName: ingested.audioFileName,
        });
      }
    } else {
      const body = await req.json().catch(() => { throw new SecurityPolicyError("Invalid JSON body.", 400); });
      if (!body || !Array.isArray(body.calls)) throw new SecurityPolicyError("Provide a calls array for batch processing.", 400);
      if (body.calls.length > MAX_BATCH_CALLS) throw new SecurityPolicyError("Import at most 10 calls per batch.", 413);
      itemsToProcess = body.calls.map((item: unknown) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) throw new SecurityPolicyError("Each batch call must be an object.", 400);
        const value = item as Record<string, unknown>;
        for (const key of ["repId", "prospectCompany", "prospectName", "callStage", "transcriptText"]) {
          if (value[key] !== undefined && typeof value[key] !== "string") throw new SecurityPolicyError(`Invalid ${key} in batch call.`, 400);
        }
        if (value.durationSeconds !== undefined && (typeof value.durationSeconds !== "number" || !Number.isFinite(value.durationSeconds) || value.durationSeconds < 0)) {
          throw new SecurityPolicyError("Invalid durationSeconds in batch call.", 400);
        }
        // JSON callers supply transcripts; audio bytes are accepted only through file uploads.
        return {
          repId: (value.repId as string) || "",
          prospectCompany: (value.prospectCompany as string) || "",
          prospectName: (value.prospectName as string) || "Lead",
          callStage: normalizeStageName((value.callStage as string) || "").slice(0, 60).trim() || "Cold Call",
          transcriptText: requireUsableTranscript(value.transcriptText as string | undefined),
          durationSeconds: (value.durationSeconds as number) || 300,
        };
      });
    }

    const forcedRepId = auth.canViewAllCalls
      ? null
      : await resolveUploadRepId(auth, {});
    if (forcedRepId) {
      itemsToProcess = itemsToProcess.map((item) => ({ ...item, repId: forcedRepId }));
    }

    if (!itemsToProcess.length) {
      return NextResponse.json({ error: "No calls provided for batch processing" }, { status: 400 });
    }
    if (itemsToProcess.length > 10) return NextResponse.json({ error: "Import at most 10 calls per batch." }, { status: 413 });

    for (const item of itemsToProcess) {
      requireUsableTranscript(item.transcriptText);
    }
    await assertEvaluationAllowed(auth, itemsToProcess.reduce(
      (credits, item) => credits + evaluationCreditsForDuration(item.durationSeconds || 300), 0
    ));

    const repIds = new Map<string, string>();
    for (const item of itemsToProcess) {
      if (!repIds.has(item.repId)) repIds.set(item.repId, await resolveUploadRepId(auth, { repId: item.repId }));
      item.repId = repIds.get(item.repId)!;
    }

    const results = [];
    for (const item of itemsToProcess) {
      const callId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const now = new Date().toISOString();
      let evaluated = false;
      try {
        await assertEvaluationAllowed(auth, evaluationCreditsForDuration(item.durationSeconds || 300));
        const audioUrl = item.audioBytes?.byteLength
          ? await saveCallAudio(callId, item.audioBytes, item.audioMimeType, item.audioFileName)
          : undefined;

        await insertCall({
          id: callId,
          repId: item.repId,
          prospectCompany: (item.prospectCompany || "").trim(),
          prospectName: (item.prospectName || "").trim() || "Lead",
          callStage: item.callStage || "Cold Call",
          coreOutcome: "Analyzing...",
          durationSeconds: item.durationSeconds || 300,
          transcriptText: item.transcriptText,
          audioUrl,
          status: "analyzing",
          createdAt: now,
        });
        const evaluation = await evaluateCall({
          callId,
          repId: item.repId,
          transcriptText: item.transcriptText,
          callStage: item.callStage,
          prospectCompany: item.prospectCompany,
          prospectName: item.prospectName,
          durationSeconds: item.durationSeconds || 300,
        });

        evaluated = true;
        await recordEvaluationUsage(auth, evaluationCreditsForDuration(item.durationSeconds || 300));

        results.push({ callId, evaluation });
      } catch (callErr: any) {
        if (callErr instanceof PaymentRequiredError || callErr instanceof QuotaExceededError) {
          return NextResponse.json({
            error: callErr.message, code: callErr.code,
            processedCount: results.filter((result) => "evaluation" in result).length,
            results,
          }, { status: callErr.status });
        }
        console.error(`Batch call ${callId} evaluation failed:`, callErr);
        if (!evaluated) await updateCallStatus(callId, "failed", "Evaluation failed", "analyzing").catch(() => {});
        results.push({ callId, error: "Failed to process call. Retry it or check server diagnostics." });
      }
    }

    return NextResponse.json({
      success: true,
      processedCount: results.filter((result) => "evaluation" in result).length,
      failedCount: results.filter((result) => "error" in result).length,
      results,
    });
  } catch (err: any) {
    if (err instanceof PaymentRequiredError || err instanceof QuotaExceededError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    const gated = workspaceErrorResponse(err);
    if (gated.status !== 500) return gated;
    console.error("Batch upload error:");
    const message = err?.message || "Batch upload failed";
    const blocked = /transcript|Gemini, OpenAI, or Groq/i.test(message);
    return NextResponse.json({ error: message }, { status: blocked ? 422 : 500 });
  }
}

export const POST = withWorkspaceApi(POSTHandler, {});

export const dynamic = "force-dynamic";

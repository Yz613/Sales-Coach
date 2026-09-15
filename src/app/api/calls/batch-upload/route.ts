import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calls } from "@/lib/db/schema";
import { evaluateCall } from "@/lib/ai/coach";
import { addCallStage, setRepFocus } from "@/lib/db/service";
import { normalizeStageName } from "@/lib/callStages";
import { ingestCallFile } from "@/lib/ingestCallFile";
import { isAudioFile } from "@/lib/audio";
import { requireUsableTranscript } from "@/lib/transcript";
import { resolveTranscriptionBackend } from "@/lib/ai/transcribe";
import { saveCallAudio } from "@/lib/callAudioStore";
import { getServerAuth } from "@/lib/auth";
import { resolveUploadRepId } from "@/lib/viewer-calls";

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

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export async function POST(req: Request) {
  try {
    const auth = await getServerAuth();
    if (auth.isClerkConfigured && !auth.userId) {
      return NextResponse.json({ error: "Sign in to upload calls." }, { status: 401 });
    }

    const contentType = req.headers.get("content-type") || "";

    let itemsToProcess: BatchItem[] = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const files = formData.getAll("files") as File[];
      const defaultRepId = (formData.get("defaultRepId") as string) || "";
      const defaultRepName = (formData.get("defaultRepName") as string) || "";
      const defaultRepRole = (formData.get("defaultRepRole") as string) || "";
      const defaultRepFocus = (formData.get("defaultRepFocus") as string) || "";
      const defaultStage = normalizeStageName((formData.get("defaultStage") as string) || "") || "Cold Call";
      if (files.some((f) => isAudioFile(f))) {
        await resolveTranscriptionBackend();
      }

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

      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const baseName = f.name.replace(/\.[^/.]+$/, "");

        if (f.name.toLowerCase().endsWith(".csv")) {
          const content = new TextDecoder("utf-8").decode(new Uint8Array(await f.arrayBuffer())).replace(/^\uFEFF/, "");
          const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
          if (lines.length > 1) {
            const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
            const transcriptIdx = header.findIndex((h) => h.includes("transcript") || h.includes("text") || h.includes("dialogue") || h.includes("body"));
            const companyIdx = header.findIndex((h) => h.includes("company") || h.includes("prospect") || h.includes("account"));
            const contactIdx = header.findIndex((h) => h.includes("contact") || h.includes("lead") || h.includes("name"));
            const stageIdx = header.findIndex((h) => h.includes("stage"));

            if (transcriptIdx !== -1) {
              for (let j = 1; j < lines.length; j++) {
                const row = parseCsvLine(lines[j]);
                const transcript = row[transcriptIdx]?.trim();
                if (!transcript) continue;
                const company = (companyIdx !== -1 && row[companyIdx]?.trim()) || "";
                const contact = (contactIdx !== -1 && row[contactIdx]?.trim()) || "Lead";
                const stage = (stageIdx !== -1 && row[stageIdx]?.trim()) || defaultStage;
                itemsToProcess.push({
                  repId: resolvedRepId,
                  prospectCompany: company,
                  prospectName: contact,
                  callStage: stage,
                  transcriptText: requireUsableTranscript(transcript),
                  durationSeconds: 300,
                });
              }
              continue;
            }
          }
          itemsToProcess.push({
            repId: resolvedRepId,
            prospectCompany: "",
            prospectName: baseName || "Lead",
            callStage: defaultStage,
            transcriptText: requireUsableTranscript(content),
            durationSeconds: 300,
          });
          continue;
        }

        const ingested = await ingestCallFile(f);
        itemsToProcess.push({
          repId: resolvedRepId,
          prospectCompany: "",
          prospectName: baseName || "Lead",
          callStage: defaultStage,
          transcriptText: requireUsableTranscript(ingested.transcriptText),
          durationSeconds: ingested.durationSeconds || 300,
          audioBytes: ingested.audioBytes,
          audioMimeType: ingested.audioMimeType,
          audioFileName: ingested.audioFileName,
        });
      }
    } else {
      const body = await req.json();
      itemsToProcess = body.calls || [];
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

    for (const item of itemsToProcess) {
      requireUsableTranscript(item.transcriptText);
    }

    const results = [];
    for (const item of itemsToProcess) {
      const callId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const now = new Date().toISOString();
      const audioUrl = item.audioBytes?.byteLength
        ? saveCallAudio(callId, item.audioBytes, item.audioMimeType, item.audioFileName)
        : undefined;

      await db.insert(calls).values({
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
      }).run();

      const evaluation = await evaluateCall({
        callId,
        repId: item.repId,
        transcriptText: item.transcriptText,
        callStage: item.callStage,
        prospectCompany: item.prospectCompany,
        prospectName: item.prospectName,
        durationSeconds: item.durationSeconds || 300,
      });

      results.push({ callId, evaluation });
    }

    return NextResponse.json({
      success: true,
      processedCount: results.length,
      results,
    });
  } catch (err: any) {
    console.error("Batch upload error:", err);
    const message = err?.message || "Batch upload failed";
    const blocked = /transcript|Gemini, OpenAI, or Groq/i.test(message);
    return NextResponse.json({ error: message }, { status: blocked ? 422 : 500 });
  }
}

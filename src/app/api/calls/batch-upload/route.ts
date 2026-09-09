import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calls } from "@/lib/db/schema";
import { evaluateCall } from "@/lib/ai/coach";
import { addCallStage, getOrCreateRep, setRepFocus } from "@/lib/db/service";
import { normalizeStageName } from "@/lib/callStages";

interface BatchItem {
  repId: string;
  prospectCompany: string;
  prospectName: string;
  callStage: string;
  transcriptText: string;
  durationSeconds?: number;
}

export async function POST(req: Request) {
  try {
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
      try {
        await addCallStage(defaultStage);
      } catch {
        // Stage list is best-effort.
      }

      const resolvedRepId = await getOrCreateRep(defaultRepId, defaultRepName, defaultRepRole);
      if (defaultRepFocus.trim()) {
        await setRepFocus(resolvedRepId, defaultRepFocus);
      }

      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const buffer = Buffer.from(await f.arrayBuffer());
        let text = "";

        if (f.name.endsWith(".mp3") || f.name.endsWith(".wav") || f.name.endsWith(".m4a")) {
          text = `[Audio file ingested: ${f.name}. Automatic transcription is not configured, so paste the transcript for a full evaluation.]`;
        } else {
          text = buffer.toString("utf-8");
        }

        const baseName = f.name.replace(/\.[^/.]+$/, "");
        itemsToProcess.push({
          repId: resolvedRepId,
          prospectCompany: `Company from ${baseName}`,
          prospectName: `Contact (${baseName})`,
          callStage: defaultStage,
          transcriptText: text,
          durationSeconds: 300,
        });
      }
    } else {
      const body = await req.json();
      itemsToProcess = body.calls || [];
    }

    if (!itemsToProcess.length) {
      return NextResponse.json({ error: "No calls provided for batch processing" }, { status: 400 });
    }

    const results = [];
    for (const item of itemsToProcess) {
      const callId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const now = new Date().toISOString();

      await db.insert(calls).values({
        id: callId,
        repId: item.repId,
        prospectCompany: item.prospectCompany || "Unknown Co",
        prospectName: item.prospectName || "Lead",
        callStage: item.callStage || "Cold Call",
        coreOutcome: "Analyzing...",
        durationSeconds: item.durationSeconds || 300,
        transcriptText: item.transcriptText,
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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

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
        const baseName = f.name.replace(/\.[^/.]+$/, "");

        if (f.name.endsWith(".mp3") || f.name.endsWith(".wav") || f.name.endsWith(".m4a")) {
          const text = `[Audio file ingested: ${f.name}. Automatic transcription is not configured, so paste the transcript for a full evaluation.]`;
          itemsToProcess.push({
            repId: resolvedRepId,
            prospectCompany: `Company from ${baseName}`,
            prospectName: `Contact (${baseName})`,
            callStage: defaultStage,
            transcriptText: text,
            durationSeconds: 300,
          });
        } else if (f.name.endsWith(".csv")) {
          const content = buffer.toString("utf-8");
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
                const company = (companyIdx !== -1 && row[companyIdx]?.trim()) || `Company ${j}`;
                const contact = (contactIdx !== -1 && row[contactIdx]?.trim()) || `Lead (${company})`;
                const stage = (stageIdx !== -1 && row[stageIdx]?.trim()) || defaultStage;
                itemsToProcess.push({
                  repId: resolvedRepId,
                  prospectCompany: company,
                  prospectName: contact,
                  callStage: stage,
                  transcriptText: transcript,
                  durationSeconds: 300,
                });
              }
            } else {
              itemsToProcess.push({
                repId: resolvedRepId,
                prospectCompany: `Company from ${baseName}`,
                prospectName: `Contact (${baseName})`,
                callStage: defaultStage,
                transcriptText: content,
                durationSeconds: 300,
              });
            }
          } else {
            itemsToProcess.push({
              repId: resolvedRepId,
              prospectCompany: `Company from ${baseName}`,
              prospectName: `Contact (${baseName})`,
              callStage: defaultStage,
              transcriptText: content,
              durationSeconds: 300,
            });
          }
        } else {
          const text = buffer.toString("utf-8");
          itemsToProcess.push({
            repId: resolvedRepId,
            prospectCompany: `Company from ${baseName}`,
            prospectName: `Contact (${baseName})`,
            callStage: defaultStage,
            transcriptText: text,
            durationSeconds: 300,
          });
        }
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

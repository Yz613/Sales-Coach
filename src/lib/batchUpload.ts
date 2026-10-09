import { durationFromTranscript } from "./audio";
import { normalizeStageName } from "./callStages";
import { SecurityPolicyError } from "./security-policy";
import { requireUsableTranscript } from "./transcript";

export const MAX_BATCH_CALLS = 10;

/** CSV records can contain commas, escaped quotes, and complete multiline dialogue. */
export function parseCsvRecords(content: string): string[][] {
  const text = content.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const finishRow = () => {
    row.push(field.trim());
    if (row.some(Boolean)) rows.push(row);
    row = [];
    field = "";
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(field.trim());
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      finishRow();
      if (char === "\r" && text[i + 1] === "\n") i++;
    } else field += char;
  }
  if (quoted) throw new SecurityPolicyError("CSV contains an unclosed quoted field.", 422);
  finishRow();
  return rows;
}

export interface BatchTranscript {
  prospectCompany: string;
  prospectName: string;
  callStage: string;
  transcriptText: string;
  durationSeconds: number;
}

export function batchTranscriptsFromCsv(content: string, fileName: string, defaultStage: string): BatchTranscript[] {
  const records = parseCsvRecords(content);
  const header = (records[0] || []).map((field) => field.toLowerCase());
  const transcriptIdx = header.findIndex((field) => /transcript|text|dialogue|body/.test(field));
  if (transcriptIdx === -1) {
    return [{ prospectCompany: "", prospectName: fileName.replace(/\.[^/.]+$/, "") || "Lead",
      callStage: defaultStage, transcriptText: requireUsableTranscript(content),
      durationSeconds: durationFromTranscript(content) || 300 }];
  }
  const rows = records.slice(1).filter((row) => row[transcriptIdx]?.trim());
  if (rows.length > MAX_BATCH_CALLS) throw new SecurityPolicyError("Import at most 10 calls per batch.", 413);
  const companyIdx = header.findIndex((field) => /company|account/.test(field) || field === "prospect");
  const contactIdx = header.findIndex((field) => /contact|lead|name/.test(field) && !/company|account/.test(field));
  const stageIdx = header.findIndex((field) => field.includes("stage"));
  return rows.map((row) => {
    const transcriptText = requireUsableTranscript(row[transcriptIdx]);
    return {
      prospectCompany: row[companyIdx] || "",
      prospectName: row[contactIdx] || "Lead",
      callStage: normalizeStageName(row[stageIdx] || defaultStage).slice(0, 60).trim() || "Cold Call",
      transcriptText,
      durationSeconds: durationFromTranscript(transcriptText) || 300,
    };
  });
}

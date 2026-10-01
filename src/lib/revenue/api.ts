import { NextResponse } from "next/server";
import { workspaceErrorResponse } from "../workspace";
import { RevenueError } from "./security";
export async function readBody(request: Request, max = 100000) {
  const reader = request.body?.getReader(); if (!reader) throw new RevenueError("Request body is required.");
  const chunks: Uint8Array[] = []; let length = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; length += value.byteLength; if (length > max) { await reader.cancel(); throw new RevenueError("Request is too large.", 413); } chunks.push(value); }
  return Buffer.concat(chunks).toString("utf8");
}
export async function readJson(request: Request) {
  const raw = await readBody(request);
  try { const result = JSON.parse(raw); if (!result || Array.isArray(result) || typeof result !== "object") throw new Error(); return result; }
  catch { throw new RevenueError("Send a valid JSON object."); }
}
export function revenueError(err: unknown) {
  if (typeof (err as any)?.status === "number") return workspaceErrorResponse(err);
  console.error("Revenue request failed", err instanceof Error ? err.name : "Unknown error");
  return NextResponse.json({ error: "Request failed. Check the server configuration and try again." }, { status: 500 });
}

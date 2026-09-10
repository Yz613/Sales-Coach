import { NextResponse } from "next/server";
import { getCallById } from "@/lib/db/service";
import { readCallAudio } from "@/lib/callAudioStore";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const call = await getCallById(id);
  if (!call) {
    return NextResponse.json({ error: "Call not found" }, { status: 404 });
  }

  const stored = readCallAudio(id);
  if (!stored) {
    return NextResponse.json({ error: "No recording stored for this call" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(stored.bytes), {
    status: 200,
    headers: {
      "Content-Type": stored.mimeType || "application/octet-stream",
      "Content-Length": String(stored.bytes.byteLength),
      "Cache-Control": "private, max-age=3600",
      "Content-Disposition": `inline; filename="${stored.fileName || `${id}.audio`}"`,
    },
  });
}

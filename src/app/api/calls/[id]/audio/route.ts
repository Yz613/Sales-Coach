import { withWorkspaceApi } from "@/lib/workspace";
import { NextResponse } from "next/server";
import { readCallAudio } from "@/lib/callAudioStore";
import { workspaceErrorResponse } from "@/lib/workspace";
import { audit } from "@/lib/revenue/connections";
import { actorId } from "@/lib/revenue/conversations";
import { requireConversation } from "@/lib/revenue/access";

async function GETHandler(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { auth } = await requireConversation(id);
    const rawSegment = new URL(req.url).searchParams.get("segment");
    const segment = rawSegment == null ? 0 : Number(rawSegment);
    if (!Number.isInteger(segment) || segment < 0 || segment > 49) {
      return NextResponse.json({ error: "Unknown recording segment" }, { status: 400 });
    }
    const stored = await readCallAudio(id, segment);
    if (!stored) {
      return NextResponse.json({ error: "No recording stored for this call" }, { status: 404 });
    }

    const size = stored.bytes.byteLength;
    let start = 0; let end = size - 1;
    const range = req.headers.get("range");
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2])) return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
      if (!match[1]) start = Math.max(0, size - Number(match[2]));
      else { start = Number(match[1]); if (match[2]) end = Math.min(size - 1, Number(match[2])); }
      if (start > end || start >= size) return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    if (!range || /^bytes=0-/.test(range)) await audit(actorId(auth), "recording.played", id);
    const fileName = (stored.fileName || `${id}.audio`).replace(/[^\x20-\x7e]|["\\]/g, "_").slice(0, 180);
    return new NextResponse(new Uint8Array(stored.bytes.subarray(start, end + 1)), {
      status: range ? 206 : 200,
      headers: {
        "Content-Type": stored.mimeType || "application/octet-stream",
        "Content-Length": String(end - start + 1),
        "Accept-Ranges": "bytes",
        ...(range ? { "Content-Range": `bytes ${start}-${end}/${size}` } : {}),
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename="${fileName}"`,
      },
    });
  } catch (err) {
    return workspaceErrorResponse(err);
  }
}

export const GET = withWorkspaceApi(GETHandler, {});

export const dynamic = "force-dynamic";

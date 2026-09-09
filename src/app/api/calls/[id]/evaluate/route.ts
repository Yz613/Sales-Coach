import { NextResponse } from "next/server";
import { evaluateCall } from "@/lib/ai/coach";
import { getVisibleCallById } from "@/lib/viewer-calls";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { call } = await getVisibleCallById(id);
    if (!call) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    const evaluation = await evaluateCall({
      callId: call.id,
      repId: call.repId,
      transcriptText: call.transcriptText,
      callStage: call.callStage,
      prospectCompany: call.prospectCompany,
      prospectName: call.prospectName,
    });

    return NextResponse.json({ success: true, evaluation });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

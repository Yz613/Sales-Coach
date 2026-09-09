import { NextResponse } from "next/server";
import { addCallStage, deleteCallStage, getCallStages, renameCallStage } from "@/lib/db/service";

export async function GET() {
  try {
    const stages = await getCallStages();
    return NextResponse.json({ stages });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const stages = await addCallStage(body.name || body.stage || "");
    return NextResponse.json({ success: true, stages });
  } catch (err: any) {
    const status = err.message?.includes("required") ? 400 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const stages = await renameCallStage(body.from || "", body.to || "");
    return NextResponse.json({ success: true, stages });
  } catch (err: any) {
    const msg = err.message || "Failed to update Call Stage Target";
    const status = /required|already exists|Unknown/.test(msg) ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const stages = await deleteCallStage(body.name || body.stage || "");
    return NextResponse.json({ success: true, stages });
  } catch (err: any) {
    const msg = err.message || "Failed to remove Call Stage Target";
    const status = /required|still has scripts|at least one/.test(msg) ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

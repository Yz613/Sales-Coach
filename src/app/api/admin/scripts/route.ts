import { NextResponse } from "next/server";
import { getAllScripts, saveScript } from "@/lib/db/service";

export async function GET() {
  try {
    const scripts = await getAllScripts();
    return NextResponse.json(scripts);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const id = body.id || `script_${Date.now()}`;

    const saved = await saveScript({
      id,
      stage: body.stage,
      title: body.title,
      content: body.content,
      keyMilestones: body.keyMilestones || [],
      isActive: body.isActive !== undefined ? body.isActive : true,
    });

    return NextResponse.json({ success: true, script: saved });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getRepPersona, saveRepPersona } from "@/lib/db/service";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const persona = getRepPersona(id);
    return NextResponse.json(persona || {
      repId: id,
      experienceLevel: "Ramping AE",
      coachingTone: "Tough Love / Direct VP",
      knownBlindspots: [],
      strengths: [],
      managerNotes: "",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const saved = saveRepPersona({
      repId: id,
      experienceLevel: body.experienceLevel || "Ramping AE",
      coachingTone: body.coachingTone || "Tough Love / Direct VP",
      knownBlindspots: body.knownBlindspots || [],
      strengths: body.strengths || [],
      managerNotes: body.managerNotes || "",
      targetQuota: body.targetQuota || undefined,
    });

    return NextResponse.json({ success: true, persona: saved });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

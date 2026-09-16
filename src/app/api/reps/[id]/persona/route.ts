import { NextResponse } from "next/server";
import { getRepPersona, saveRepPersona } from "@/lib/db/service";
import { requireWorkspace, workspaceErrorResponse } from "@/lib/workspace";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireWorkspace();
    const { id } = await params;
    const persona = await getRepPersona(id);
    return NextResponse.json(persona || {
      repId: id,
      experienceLevel: "Ramping AE",
      coachingTone: "Tough Love / Direct VP",
      knownBlindspots: [],
      strengths: [],
      managerNotes: "",
    });
  } catch (err: any) {
    return workspaceErrorResponse(err);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireWorkspace();
    const { id } = await params;
    const body = await req.json();

    const saved = await saveRepPersona({
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
    return workspaceErrorResponse(err);
  }
}

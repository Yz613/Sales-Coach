import { NextResponse } from "next/server";
import { getCoachInstructions, setCoachInstructions, getCoachLessons, coachUsesDefaultSandler } from "@/lib/db/service";
import { requireWorkspace, workspaceErrorResponse } from "@/lib/workspace";

export async function GET() {
  try {
    await requireWorkspace();
    const [instructions, lessons, isDefault] = await Promise.all([
      getCoachInstructions(),
      getCoachLessons(),
      coachUsesDefaultSandler(),
    ]);
    return NextResponse.json({ instructions, lessons, isDefault });
  } catch (err: any) {
    return workspaceErrorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    await requireWorkspace();
    const body = await req.json();
    if (typeof body.instructions === "string") {
      await setCoachInstructions(body.instructions);
    }
    const isDefault = await coachUsesDefaultSandler();
    return NextResponse.json({ success: true, isDefault });
  } catch (err: any) {
    return workspaceErrorResponse(err);
  }
}

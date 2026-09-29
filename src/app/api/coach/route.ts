import { NextResponse } from "next/server";
import { getCoachInstructions, setCoachInstructions, getCoachLessons, coachUsesDefaultSandler, getSalesMethodId, setSalesMethodId } from "@/lib/db/service";
import { requireWorkspace, workspaceErrorResponse } from "@/lib/workspace";

export async function GET() {
  try {
    await requireWorkspace();
    const [instructions, lessons, isDefault, methodology] = await Promise.all([
      getCoachInstructions(),
      getCoachLessons(),
      coachUsesDefaultSandler(),
      getSalesMethodId(),
    ]);
    return NextResponse.json({ instructions, lessons, isDefault, methodology });
  } catch (err: any) {
    return workspaceErrorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    await requireWorkspace();
    const body = await req.json();
    if (typeof body.methodology === "string") {
      await setSalesMethodId(body.methodology);
    }
    if (typeof body.instructions === "string") {
      await setCoachInstructions(body.instructions);
    }
    const isDefault = await coachUsesDefaultSandler();
    return NextResponse.json({ success: true, isDefault, methodology: await getSalesMethodId() });
  } catch (err: any) {
    return workspaceErrorResponse(err);
  }
}

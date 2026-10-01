import { withWorkspaceApi } from "@/lib/workspace";
import { NextResponse } from "next/server";
import { getCoachInstructions, setCoachInstructions, getCoachLessons, coachUsesDefaultSandler, getSalesMethodId, setSalesMethodId, getScoreWeights, setScoreWeights } from "@/lib/db/service";
import { requireWorkspace, workspaceErrorResponse } from "@/lib/workspace";

async function GETHandler() {
  try {
    await requireWorkspace();
    const methodology = await getSalesMethodId();
    const [instructions, lessons, isDefault, weights] = await Promise.all([
      getCoachInstructions(),
      getCoachLessons(),
      coachUsesDefaultSandler(),
      getScoreWeights(),
    ]);
    return NextResponse.json({ instructions, lessons, isDefault, methodology, weights });
  } catch (err: any) {
    return workspaceErrorResponse(err);
  }
}

async function POSTHandler(req: Request) {
  try {
    await requireWorkspace();
    const body = await req.json();
    if (typeof body.methodology === "string") {
      await setSalesMethodId(body.methodology);
    }
    if (typeof body.instructions === "string") {
      await setCoachInstructions(body.instructions);
    }
    const weights = body.weights && typeof body.weights === "object" ? await setScoreWeights(body.weights) : await getScoreWeights();
    const isDefault = await coachUsesDefaultSandler();
    return NextResponse.json({ success: true, isDefault, methodology: await getSalesMethodId(), weights });
  } catch (err: any) {
    return workspaceErrorResponse(err);
  }
}

export const GET = withWorkspaceApi(GETHandler, { admin: true });
export const POST = withWorkspaceApi(POSTHandler, { admin: true });

export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { withWorkspaceApi, requireWorkspace, workspaceErrorResponse } from "@/lib/workspace";
import { insertDialLog } from "@/lib/db/service";
import { resolveUploadRepId } from "@/lib/viewer-calls";
import { isDialOutcome, dialOutcomeLabel } from "@/lib/dialFunnel";

async function POSTHandler(req: Request) {
  try {
    const auth = await requireWorkspace();
    const body = await req.json().catch(() => null);
    if (!isDialOutcome(body?.outcome)) {
      return NextResponse.json({ error: "Choose a dial outcome." }, { status: 400 });
    }
    const prospectName = typeof body.prospectName === "string" ? body.prospectName.trim().slice(0, 120) : "";
    const prospectCompany = typeof body.prospectCompany === "string" ? body.prospectCompany.trim().slice(0, 160) : "";
    const repId = await resolveUploadRepId(auth, {
      repId: typeof body.repId === "string" ? body.repId : undefined,
    });
    const id = `dial_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await insertDialLog({
      id,
      repId,
      prospectName: prospectName || "Unknown",
      prospectCompany: prospectCompany || "Unknown",
      outcome: body.outcome,
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ id, outcome: body.outcome, label: dialOutcomeLabel(body.outcome) });
  } catch (err) {
    return workspaceErrorResponse(err);
  }
}

export const POST = withWorkspaceApi(POSTHandler, {});
export const dynamic = "force-dynamic";

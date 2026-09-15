import { NextResponse } from "next/server";
import { getAllReps } from "@/lib/db/service";
import { getServerAuth } from "@/lib/auth";
import { isOwnRep } from "@/lib/call-access";
import { toCallViewer } from "@/lib/viewer-calls";

export async function GET() {
  try {
    const auth = await getServerAuth();
    const reps = await getAllReps();
    if (auth.canViewAllCalls) {
      return NextResponse.json(reps);
    }
    return NextResponse.json(reps.filter((rep) => isOwnRep(rep, toCallViewer(auth))));
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

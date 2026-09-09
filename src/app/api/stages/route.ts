import { NextResponse } from "next/server";
import { getCallStages } from "@/lib/db/service";

/** Member-accessible list of Call Stage Targets (defaults + custom script types). */
export async function GET() {
  try {
    const stages = await getCallStages();
    return NextResponse.json({ stages });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

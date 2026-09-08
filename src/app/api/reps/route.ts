import { NextResponse } from "next/server";
import { getAllReps } from "@/lib/db/service";

export async function GET() {
  try {
    const reps = getAllReps();
    return NextResponse.json(reps);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

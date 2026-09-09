import { NextResponse } from "next/server";
import { getCoachInstructions, setCoachInstructions, getCoachLessons, coachUsesDefaultSandler } from "@/lib/db/service";

export async function GET() {
  try {
    const [instructions, lessons, isDefault] = await Promise.all([
      getCoachInstructions(),
      getCoachLessons(),
      coachUsesDefaultSandler(),
    ]);
    return NextResponse.json({ instructions, lessons, isDefault });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (typeof body.instructions === "string") {
      await setCoachInstructions(body.instructions);
    }
    const isDefault = await coachUsesDefaultSandler();
    return NextResponse.json({ success: true, isDefault });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

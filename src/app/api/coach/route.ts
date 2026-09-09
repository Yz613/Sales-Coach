import { NextResponse } from "next/server";
import { getCoachInstructions, setCoachInstructions, getCoachLessons } from "@/lib/db/service";

export async function GET() {
  try {
    const [instructions, lessons] = await Promise.all([
      getCoachInstructions(),
      getCoachLessons(),
    ]);
    return NextResponse.json({ instructions, lessons });
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
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getExecutiveAnalytics } from "@/lib/db/service";

export async function GET() {
  try {
    const analytics = getExecutiveAnalytics();
    return NextResponse.json(analytics);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

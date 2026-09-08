import { NextResponse } from "next/server";
import { getSuperAdminReport } from "@/lib/db/service";

export async function GET() {
  try {
    const report = getSuperAdminReport();
    return NextResponse.json(report);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

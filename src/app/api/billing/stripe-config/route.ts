import { NextResponse } from "next/server";
import { withPublicApi } from "@/lib/workspace";
export const dynamic = "force-dynamic";
async function retired() {
  return NextResponse.json({ error: "Configure payment credentials through deployment secrets." }, { status: 410 });
}
export const GET = withPublicApi(retired);
export const POST = withPublicApi(retired);

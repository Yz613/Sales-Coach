import { NextResponse } from "next/server";
import { getRepById } from "@/lib/db/service";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await getRepById(id);
    if (!data.rep) {
      return NextResponse.json({ error: "Rep not found" }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

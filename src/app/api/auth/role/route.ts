import { NextRequest, NextResponse } from "next/server";
import { getServerAuth, UserRole } from "@/lib/auth";

export async function GET() {
  const auth = await getServerAuth();
  return NextResponse.json(auth);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const role = body.role as UserRole;

    if (role !== "admin" && role !== "member") {
      return NextResponse.json({ error: "Invalid role specified" }, { status: 400 });
    }

    const response = NextResponse.json({ success: true, role });
    response.cookies.set("sc_role", role, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      sameSite: "lax",
      httpOnly: false, // accessible for quick client-side sync
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

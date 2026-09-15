import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/auth";

function withClearedRoleCookie(response: NextResponse) {
  response.cookies.set("sc_role", "", {
    path: "/",
    maxAge: 0,
    sameSite: "lax",
  });
  return response;
}

export async function GET() {
  const auth = await getServerAuth();
  return withClearedRoleCookie(NextResponse.json(auth));
}

export async function POST() {
  return withClearedRoleCookie(
    NextResponse.json({ error: "Roles cannot be switched in the app." }, { status: 403 })
  );
}

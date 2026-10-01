import { withPublicApi } from "@/lib/workspace";
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

async function GETHandler() {
  try {
    const auth = await getServerAuth();
    return withClearedRoleCookie(NextResponse.json(auth));
  } catch (err) {
    console.warn("GET /api/auth/role failed:");
    return withClearedRoleCookie(
      NextResponse.json({ error: "Auth is unavailable." }, { status: 200 })
    );
  }
}

async function POSTHandler() {
  return withClearedRoleCookie(
    NextResponse.json({ error: "Roles cannot be switched in the app." }, { status: 403 })
  );
}

export const GET = withPublicApi(GETHandler, {});
export const POST = withPublicApi(POSTHandler, {});

export const dynamic = "force-dynamic";

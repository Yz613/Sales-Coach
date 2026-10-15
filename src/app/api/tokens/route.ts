import { NextResponse } from "next/server";
import { withWorkspaceApi } from "@/lib/workspace";
import { requireWorkspace } from "@/lib/workspace";
import { createApiToken, listApiTokens, revokeApiToken } from "@/lib/apiTokens";
import { revenueError } from "@/lib/revenue/api";

export const GET = withWorkspaceApi(async (request: Request) => {
  try {
    const auth = await requireWorkspace();
    const tokens = await listApiTokens(auth);
    return NextResponse.json({ tokens });
  } catch (error) {
    return revenueError(error);
  }
});

export const POST = withWorkspaceApi(async (request: Request) => {
  try {
    const auth = await requireWorkspace();
    const body = await request.json();
    const token = await createApiToken(body.name || "Default Bot", auth);
    return NextResponse.json({ token });
  } catch (error) {
    return revenueError(error);
  }
});

export const DELETE = withWorkspaceApi(async (request: Request) => {
  try {
    const auth = await requireWorkspace();
    const body = await request.json();
    if (!body.id) throw new Error("Token ID is required.");
    const success = await revokeApiToken(body.id, auth);
    return NextResponse.json({ success });
  } catch (error) {
    return revenueError(error);
  }
});

export const dynamic = "force-dynamic";

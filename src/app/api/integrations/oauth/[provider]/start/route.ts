import { NextResponse } from "next/server";
import { withWorkspaceApi } from "@/lib/workspace";
import { requireRevenueAdmin } from "@/lib/revenue/access";
import { actorId } from "@/lib/revenue/conversations";
import { readJson, revenueError } from "@/lib/revenue/api";
import { OAUTH_COOKIE, oauthProvider, startOAuth } from "@/lib/integrations/oauth";

export const POST = withWorkspaceApi(async (req: Request, ctx: { params: Promise<{ provider: string }> }) => {
  try {
    const provider = oauthProvider((await ctx.params).provider); const auth = await requireRevenueAdmin();
    const result = await startOAuth(provider, actorId(auth), await readJson(req), new URL(req.url).origin);
    const response = NextResponse.json({ url: result.url });
    response.cookies.set(OAUTH_COOKIE, result.state, { httpOnly: true, secure: new URL(req.url).protocol === "https:", sameSite: "lax", path: "/app/api/integrations/oauth", maxAge: 600 });
    return response;
  } catch (error) { return revenueError(error); }
}, { admin: true });
export const dynamic = "force-dynamic";

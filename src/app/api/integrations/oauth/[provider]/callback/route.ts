import { NextResponse, after } from "next/server";
import { withWorkspaceApi } from "@/lib/workspace";
import { requireRevenueAdmin } from "@/lib/revenue/access";
import { actorId } from "@/lib/revenue/conversations";
import { connectIntegration } from "@/lib/revenue/connections";
import { enqueueSync, processJobs } from "@/lib/revenue/jobs";
import { getConnection } from "@/lib/revenue/connections";
import { currentTenantId } from "@/lib/tenant";
import { OAUTH_COOKIE, oauthProvider, finishOAuth } from "@/lib/integrations/oauth";
import { RevenueError } from "@/lib/revenue/security";

export const GET = withWorkspaceApi(async (req: Request, ctx: { params: Promise<{ provider: string }> }) => {
  const provider = oauthProvider((await ctx.params).provider); const url = new URL(req.url);
  const destination = new URL(`/app/admin/integrations/${provider}`, url.origin);
  try {
    const auth = await requireRevenueAdmin();
    if (url.searchParams.has("error")) throw new RevenueError("Sign-in was cancelled or access was declined. You can try again.");
    const browserState = req.headers.get("cookie")?.split(";").map(part => part.trim()).find(part => part.startsWith(`${OAUTH_COOKIE}=`))?.slice(OAUTH_COOKIE.length + 1) || "";
    const result = await finishOAuth(provider, actorId(auth), url.searchParams.get("state") || "", browserState, url.searchParams.get("code") || "");
    const id = await connectIntegration({ ...result.body, provider }, actorId(auth), result.secrets);
    const connection = await getConnection(id);
    if (!connection.config.pendingSetup && !["slack", "discord"].includes(provider)) {
      await enqueueSync(id); const orgId = currentTenantId(); after(() => processJobs(orgId, 4));
    }
    destination.searchParams.set("connected", connection.config.pendingSetup ? "setup" : "1");
  } catch (error) {
    destination.searchParams.set("connectionError", error instanceof RevenueError ? error.message : "The connection could not be completed. Start sign-in again.");
  }
  const response = NextResponse.redirect(destination, 303);
  response.cookies.set(OAUTH_COOKIE, "", { httpOnly: true, secure: url.protocol === "https:", sameSite: "lax", path: "/app/api/integrations/oauth", maxAge: 0 });
  return response;
}, { admin: true });
export const dynamic = "force-dynamic";

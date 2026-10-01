import { NextResponse } from "next/server";
import { withPublicApi } from "@/lib/workspace";
import { liveWebhookResponse } from "@/lib/integrations/webhook-route";
type Context = { params: Promise<{ provider: string }> };
export const POST = withPublicApi(async (req: Request, ctx: Context) => {
  const { provider } = await ctx.params;
  if (!["hubspot", "fireflies", "zapier", "make"].includes(provider)) return NextResponse.json({ error: "Live feed not found." }, { status: 404 });
  return liveWebhookResponse(req, provider);
}, { webhook: true });
export const dynamic = "force-dynamic";
export const maxDuration = 60;

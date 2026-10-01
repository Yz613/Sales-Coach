import { withPublicApi } from "@/lib/workspace";
import { liveWebhookResponse } from "@/lib/integrations/webhook-route";
export const POST = withPublicApi((req: Request) => liveWebhookResponse(req, "fathom"), { webhook: true });
export const dynamic = "force-dynamic";
export const maxDuration = 60;

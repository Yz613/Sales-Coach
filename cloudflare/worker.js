import { getApexAliasRedirect, getApexIntegrationsRewrite, getApexMarketingRewrite } from "../src/lib/public-path";
import { isClerkProxyPath, forwardClerkProxyRequest } from "../src/lib/clerkProxy";
import openNext, {
  DOQueueHandler,
  DOShardedTagCache,
  BucketCachePurge,
} from "../.open-next/worker.js";

export { DOQueueHandler, DOShardedTagCache, BucketCachePurge };

export default {
  async scheduled(_event, env, ctx) {
    if (!env.INTEGRATION_CRON_SECRET || !env.PUBLIC_APP_URL) return;
    ctx.waitUntil(openNext.fetch(new Request(new URL("/app/api/jobs/run", env.PUBLIC_APP_URL), {
      method: "POST", headers: { authorization: `Bearer ${env.INTEGRATION_CRON_SECRET}` },
    }), env, ctx).then(response => { if (!response.ok) throw new Error(`Integration cron failed: ${response.status}`); }));
  },
  async fetch(request, env, ctx) {
    const alias = getApexAliasRedirect(request.url);
    if (alias) {
      return Response.redirect(alias.location, alias.status);
    }
    const pathname = new URL(request.url).pathname;
    if (isClerkProxyPath(pathname)) {
      return forwardClerkProxyRequest(request, env);
    }
    const marketing = getApexMarketingRewrite(request.url);
    if (marketing) {
      return openNext.fetch(new Request(marketing, request), env, ctx);
    }
    const integrations = getApexIntegrationsRewrite(request.url);
    if (integrations) {
      return openNext.fetch(new Request(integrations, request), env, ctx);
    }
    return openNext.fetch(request, env, ctx);
  },
};

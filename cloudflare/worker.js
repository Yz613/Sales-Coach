import { getApexAliasRedirect, getApexMarketingRewrite } from "../src/lib/public-path";
import { isClerkProxyPath, forwardClerkProxyRequest } from "../src/lib/clerkProxy";
import openNext, {
  DOQueueHandler,
  DOShardedTagCache,
  BucketCachePurge,
} from "../.open-next/worker.js";

export { DOQueueHandler, DOShardedTagCache, BucketCachePurge };

export default {
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
    return openNext.fetch(request, env, ctx);
  },
};

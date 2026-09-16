import { getApexAliasRedirect, getApexInternalRewrite, getApexSeoFile } from "../src/lib/public-path";
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
    const seo = getApexSeoFile(request.url);
    if (seo) {
      return new Response(seo.body, {
        headers: {
          "content-type": seo.contentType,
          "cache-control": "public, max-age=3600",
        },
      });
    }
    const rewrite = getApexInternalRewrite(request.url, request.method);
    if (rewrite) {
      return openNext.fetch(new Request(rewrite.destination, request), env, ctx);
    }
    return openNext.fetch(request, env, ctx);
  },
};

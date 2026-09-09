import { getApexAliasRedirect } from "../src/lib/public-path";
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
    return openNext.fetch(request, env, ctx);
  },
};

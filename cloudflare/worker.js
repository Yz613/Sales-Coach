import { apexWorkerAction } from "../src/lib/public-path";
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
    const action = apexWorkerAction(request.url);
    if (action.type === "redirect") {
      return Response.redirect(action.location, action.status);
    }
    const pathname = new URL(request.url).pathname;
    if (isClerkProxyPath(pathname)) {
      return forwardClerkProxyRequest(request, env);
    }
    if (action.type === "rewrite") {
      return openNext.fetch(new Request(action.url, request), env, ctx);
    }
    if (action.type === "not-found") {
      const headers = new Headers(request.headers);
      headers.delete("content-length");
      const response = await openNext.fetch(new Request(action.url, { method: "GET", headers, redirect: "manual" }), env, ctx);
      if (response.status >= 500) return response;
      const out = new Headers(response.headers);
      out.set("x-robots-tag", "noindex");
      out.set("cache-control", "no-store");
      return new Response(response.body, { status: 404, statusText: "Not Found", headers: out });
    }
    return openNext.fetch(request, env, ctx);
  },
};

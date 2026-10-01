import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CLERK_JS_PROXY_SRC,
  CLERK_UI_PROXY_SRC,
  CLERK_FAPI_ORIGIN,
  CLERK_PROXY_PUBLIC_PATH,
  clerkProxyPublicUrl,
  disguiseClerkAssetPath,
  isClerkProxyPath,
  matchClerkProxyPath,
  rewriteClerkProxyRest,
  rewriteClerkProxyCookie,
  resolveClerkProxyLocation,
  sameClerkLocation,
  forwardClerkProxyRequest,
} from "./clerkProxy";
const { loginAssetsHealthy, main: verifyLoginAssets } = require("../../scripts/verify-login-assets.cjs");

describe("clerk proxy paths", () => {
  it("matches first-party auth prefixes and rewrites blocked script names", () => {
    assert.equal(matchClerkProxyPath("/app/__auth"), "/app/__auth");
    assert.equal(matchClerkProxyPath("/app/__auth/v1/client"), "/app/__auth");
    assert.equal(matchClerkProxyPath("/__auth/v1/client"), "/__auth");
    assert.equal(matchClerkProxyPath("/__clerk/npm/@clerk/clerk-js@6/dist/sdk.js"), "/__clerk");
    assert.equal(isClerkProxyPath("/app/sign-in"), false);
    assert.equal(
      rewriteClerkProxyRest("/app/__auth/npm/@clerk/clerk-js@6/dist/sdk.js", "/app/__auth"),
      "/npm/@clerk/clerk-js@6/dist/clerk.browser.js"
    );
    assert.equal(
      rewriteClerkProxyRest("/app/__auth/npm/@clerk/ui@1/dist/ui.js", "/app/__auth"),
      "/npm/@clerk/ui@1/dist/ui.browser.js"
    );
    assert.equal(rewriteClerkProxyRest("/app/__auth/v1/client", "/app/__auth"), "/v1/client");
    assert.equal(clerkProxyPublicUrl(), "https://refreshqueue.com/app/__auth");
    assert.equal(CLERK_PROXY_PUBLIC_PATH, "/app/__auth");
    assert.equal(
      disguiseClerkAssetPath("/npm/@clerk/clerk-js@6.32.0/dist/clerk.browser.js"),
      "/assets/session@6.32.0/sdk.js"
    );
    assert.equal(
      disguiseClerkAssetPath("/app/__auth/npm/@clerk/clerk-js@6.32.0/dist/clerk.browser.js".replace(/^\/app\/__auth/, "")),
      "/assets/session@6.32.0/sdk.js"
    );
    assert.match(CLERK_JS_PROXY_SRC, /sdk\.js$/);
    assert.equal(CLERK_JS_PROXY_SRC.includes("clerk.browser"), false);
    assert.equal(CLERK_JS_PROXY_SRC.includes("@clerk"), false);
    assert.equal(CLERK_UI_PROXY_SRC.includes("@clerk"), false);
  });

  it("maps entry scripts and lazy chunks to the same upstream package version", () => {
    for (const [publicPath, upstreamPath] of [
      ["/assets/session@6/sdk.js", "/npm/@clerk/clerk-js@6/dist/clerk.browser.js"],
      ["/assets/interface@1/ui.js", "/npm/@clerk/ui@1/dist/ui.browser.js"],
      ["/assets/interface@1.32.0/ui.js", "/npm/@clerk/ui@1.32.0/dist/ui.browser.js"],
      ["/assets/interface@1.32.0/42.aabbcc.js", "/npm/@clerk/ui@1.32.0/dist/42.aabbcc.js"],
      ["/assets/session@6.32.0/42.aabbcc.js", "/npm/@clerk/clerk-js@6.32.0/dist/42.aabbcc.js"],
    ]) {
      assert.equal(rewriteClerkProxyRest(`${CLERK_PROXY_PUBLIC_PATH}${publicPath}`, CLERK_PROXY_PUBLIC_PATH), upstreamPath);
      assert.equal(disguiseClerkAssetPath(upstreamPath), publicPath);
    }
  });
});

describe("hosted Clerk proxy wiring", () => {
  it("serves Clerk JS from the first-party proxy instead of clerk.refreshqueue.com", () => {
    const wrangler = readFileSync(new URL("../../wrangler.jsonc", import.meta.url), "utf8");
    assert.match(wrangler, /NEXT_PUBLIC_CLERK_PROXY_URL": "\/app\/__auth"/);
    assert.ok(wrangler.includes(`"NEXT_PUBLIC_CLERK_JS_URL": "${CLERK_JS_PROXY_SRC}"`));
    assert.ok(wrangler.includes(`"NEXT_PUBLIC_CLERK_UI_URL": "${CLERK_UI_PROXY_SRC}"`));

    const worker = readFileSync(new URL("../../cloudflare/worker.js", import.meta.url), "utf8");
    assert.match(worker, /forwardClerkProxyRequest/);
    assert.match(worker, /isClerkProxyPath/);
    assert.match(wrangler, /refreshqueue.com\/__auth\/\*/);
    assert.equal(worker.indexOf("getApexAliasRedirect") < worker.indexOf("isClerkProxyPath(pathname)"), true);

    const provider = readFileSync(new URL("../components/AuthProvider.tsx", import.meta.url), "utf8");
    assert.match(provider, /telemetry=\{\{ disabled: true \}\}/);
    assert.match(provider, /proxyUrl=\{process\.env\.NEXT_PUBLIC_CLERK_PROXY_URL \|\| "\/app\/__auth"\}/);
    const nextConfig = readFileSync(new URL("../../next.config.ts", import.meta.url), "utf8");
    assert.match(nextConfig, /NEXT_PUBLIC_CLERK_PROXY_URL/);
    assert.match(nextConfig, /NEXT_PUBLIC_CLERK_JS_URL/);
  });
});

describe("clerk proxy redirects", () => {
  it("does not bounce oauth_callback onto itself", () => {
    const request = "https://refreshqueue.com/app/__auth/v1/oauth_callback?code=abc&state=xyz";
    const proxy = "https://refreshqueue.com/app/__auth";
    const loop = resolveClerkProxyLocation(
      request,
      "https://clerk.refreshqueue.com/v1/oauth_callback?code=abc&state=xyz",
      proxy,
      301
    );
    assert.equal(loop.status, 303);
    assert.equal(loop.location, "https://refreshqueue.com/app/sign-in");
    assert.equal(sameClerkLocation(request, request), true);

    const nextHop = resolveClerkProxyLocation(
      "https://refreshqueue.com/app/__auth/v1/oauth_callback",
      "https://clerk.refreshqueue.com/v1/oauth_callback?err_code=authorization_invalid",
      proxy,
      301
    );
    assert.equal(nextHop.status, 301);
    assert.equal(
      nextHop.location,
      "https://refreshqueue.com/app/__auth/v1/oauth_callback?err_code=authorization_invalid"
    );

    const app = resolveClerkProxyLocation(
      request,
      "https://refreshqueue.com/app/sign-in",
      proxy,
      302
    );
    assert.equal(app.status, 302);
    assert.equal(app.location, "https://refreshqueue.com/app/sign-in");
  });

  it("rewrites FAPI session cookies onto the app domain", () => {
    assert.match(
      rewriteClerkProxyCookie("__session=abc; Path=/; Domain=clerk.refreshqueue.com; Secure"),
      /Domain=refreshqueue\.com/
    );
    assert.doesNotMatch(
      rewriteClerkProxyCookie("__session=abc; Path=/; Domain=clerk.refreshqueue.com; Secure"),
      /clerk\.refreshqueue\.com/
    );
  });

  it("keeps canonical asset redirects first-party and preserves the resolved version", () => {
    for (const [requestUrl, upstream, expected] of [
      [CLERK_JS_PROXY_SRC, "/npm/@clerk/clerk-js@6.32.0/dist/clerk.browser.js", "/assets/session@6.32.0/sdk.js"],
      [CLERK_UI_PROXY_SRC, "/npm/@clerk/ui@1.32.0/dist/ui.browser.js", "/assets/interface@1.32.0/ui.js"],
    ]) {
      const result = resolveClerkProxyLocation(
        `https://refreshqueue.com${requestUrl}`,
        `${CLERK_FAPI_ORIGIN}${upstream}`,
        clerkProxyPublicUrl(),
        302
      );
      assert.deepEqual(result, { status: 302, location: `${clerkProxyPublicUrl()}${expected}` });
    }
  });
});

describe("clerk proxy requests", () => {
  it("forwards aliased scripts, chunks, and API calls without changing authentication headers", async () => {
    const targets: string[] = [];
    const mockedFetch = mock.method(globalThis, "fetch", async (input: URL, init: RequestInit) => {
      targets.push(input.href);
      const headers = new Headers(init.headers);
      assert.equal(headers.get("Clerk-Proxy-Url"), clerkProxyPublicUrl());
      assert.equal(headers.get("Clerk-Secret-Key"), "fixture-secret");
      assert.equal(headers.get("cookie"), "__client=fixture");
      return new Response("fixture", { headers: { "content-type": "application/javascript" } });
    });
    try {
      for (const path of [
        "/assets/session@6/sdk.js",
        "/assets/interface@1.32.0/ui.js",
        "/assets/interface@1.32.0/42.aabbcc.js",
        "/v1/client",
      ]) {
        const response = await forwardClerkProxyRequest(
          new Request(`${clerkProxyPublicUrl()}${path}?test=1`, { headers: { cookie: "__client=fixture" } }),
          { CLERK_SECRET_KEY: "fixture-secret" }
        );
        assert.equal(response.status, 200);
        assert.equal(await response.text(), "fixture");
      }
      assert.deepEqual(targets, [
        `${CLERK_FAPI_ORIGIN}/npm/@clerk/clerk-js@6/dist/clerk.browser.js?test=1`,
        `${CLERK_FAPI_ORIGIN}/npm/@clerk/ui@1.32.0/dist/ui.browser.js?test=1`,
        `${CLERK_FAPI_ORIGIN}/npm/@clerk/ui@1.32.0/dist/42.aabbcc.js?test=1`,
        `${CLERK_FAPI_ORIGIN}/v1/client?test=1`,
      ]);
    } finally {
      mockedFetch.mock.restore();
    }
  });
});

describe("deployed login verification", () => {
  it("follows canonical first-party script redirects", async () => {
    const requested: string[] = [];
    assert.equal(await loginAssetsHealthy("https://example.com", async (input: string) => {
      requested.push(input);
      return input.includes("session@6/")
        ? new Response(null, { status: 307, headers: { location: "/app/__auth/assets/session@6.32.0/sdk.js" } })
        : new Response("fixture", { headers: { "content-type": "text/javascript; charset=utf-8" } });
    }), true);
    assert.equal(requested.length, 3);
  });

  it("rejects HTML, missing scripts, vendor redirects, and redirect loops", async () => {
    for (const response of [
      () => new Response("<html>Not found</html>", { headers: { "content-type": "text/html" } }),
      () => new Response("Not found", { status: 404 }),
      () => new Response(null, { status: 307, headers: { location: "https://clerk.example.com/npm/@clerk/clerk-js@6/dist/clerk.browser.js" } }),
      () => new Response(null, { status: 307, headers: { location: "/app/__auth/assets/session@6/sdk.js" } }),
    ]) {
      assert.equal(await loginAssetsHealthy("https://example.com", async () => response()), false);
    }
  });

  it("retries a rollout and fails when either login bundle stays unavailable", async () => {
    const env = { PUBLIC_APP_URL: "https://example.com" };
    let delays = 0;
    const delay = async () => { delays++; };
    await verifyLoginAssets({ env, delay, fetch: async () => delays === 0
      ? new Response("Rolling out", { status: 503 })
      : new Response("fixture", { headers: { "content-type": "application/javascript" } }) });
    assert.equal(delays, 1);
    await assert.rejects(verifyLoginAssets({ env, delay, fetch: async (input: string) => input.includes("/interface@")
      ? new Response("Missing", { status: 503 })
      : new Response("fixture", { headers: { "content-type": "application/javascript" } }) }), /login bundles failed/);
  });
});

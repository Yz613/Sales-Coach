import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CLERK_JS_PROXY_SRC,
  CLERK_PROXY_PUBLIC_PATH,
  clerkProxyPublicUrl,
  disguiseClerkAssetPath,
  isClerkProxyPath,
  matchClerkProxyPath,
  rewriteClerkProxyRest,
  rewriteClerkProxyCookie,
  resolveClerkProxyLocation,
  sameClerkLocation,
} from "./clerkProxy";

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
      "/npm/@clerk/clerk-js@6.32.0/dist/sdk.js"
    );
    assert.equal(
      disguiseClerkAssetPath("/app/__auth/npm/@clerk/clerk-js@6.32.0/dist/clerk.browser.js".replace(/^\/app\/__auth/, "")),
      "/npm/@clerk/clerk-js@6.32.0/dist/sdk.js"
    );
    assert.match(CLERK_JS_PROXY_SRC, /sdk\.js$/);
    assert.equal(CLERK_JS_PROXY_SRC.includes("clerk.browser"), false);
  });
});

describe("hosted Clerk proxy wiring", () => {
  it("serves Clerk JS from the first-party proxy instead of clerk.refreshqueue.com", () => {
    const wrangler = readFileSync(new URL("../../wrangler.jsonc", import.meta.url), "utf8");
    assert.match(wrangler, /NEXT_PUBLIC_CLERK_PROXY_URL": "\/app\/__auth"/);
    assert.match(wrangler, /NEXT_PUBLIC_CLERK_JS_URL": "\/app\/__auth\/npm\/@clerk\/clerk-js@6\/dist\/sdk\.js"/);

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
});

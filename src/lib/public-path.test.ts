import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  APP_BASE_PATH,
  getPublicPath,
  stripAppBasePath,
  toAppPath,
  isPublicAuthRoute,
  isPublicApiRoute,
  isApiRoute,
  isBareCallsPath,
  isApexFaviconPath,
  isApexPricingPath,
  isPublicMarketingPath,
  isMarketingAppPath,
  isCheckoutPath,
  getApexAliasRedirect,
  getApexIntegrationsRewrite,
  getApexMarketingRewrite,
  getApexPrivacyRewrite,
  getApexContentRewrite,
  getApexNotFoundRewrite,
  apexWorkerAction,
  isPublicDocumentPath,
  PUBLIC_SITEMAP_PATHS,
} from "./public-path";
import { readFileSync } from "node:fs";

describe("toAppPath", () => {
  it("keeps server redirects compatible with Next's automatic base path", () => {
    const { addPathPrefix } = require("next/dist/shared/lib/router/utils/add-path-prefix");
    for (const path of ["/sign-in", "/select-organization", "/subscribe", "/workspaces", "/calls", "/user?security=mfa"]) {
      const nextTarget = addPathPrefix(stripAppBasePath(toAppPath(path)), APP_BASE_PATH);
      assert.equal(nextTarget, toAppPath(path));
      assert.ok(!nextTarget.startsWith("/app/app/"));
    }
  });

  it("recovers repeated base paths without losing query parameters", () => {
    for (const prefix of ["/app/app", "/app/app/app"]) {
      const original = `https://refreshqueue.com${prefix}/sign-in?redirect_url=%2Fapp%2Fcalls`;
      const result = getApexAliasRedirect(original);
      assert.deepEqual(result, { location: "https://refreshqueue.com/app/sign-in?redirect_url=%2Fapp%2Fcalls", status: 307 });
      assert.equal(getApexAliasRedirect(result!.location), null);
    }
    assert.equal(getApexAliasRedirect("https://refreshqueue.com/app/applications"), null);
  });
  it("prefixes a root-relative path with /app", () => {
    assert.equal(toAppPath("/calls"), "/app/calls");
    assert.equal(toAppPath("calls"), "/app/calls");
    assert.equal(toAppPath("/"), "/app/");
  });

  it("does not double-prefix paths that already include the base path", () => {
    assert.equal(toAppPath("/app"), "/app");
    assert.equal(toAppPath("/app/calls"), "/app/calls");
    assert.equal(toAppPath("/app/calls/abc"), "/app/calls/abc");
  });
});

describe("stripAppBasePath", () => {
  it("strips /app from public paths", () => {
    assert.equal(stripAppBasePath("/app"), "/");
    assert.equal(stripAppBasePath("/app/calls"), "/calls");
    assert.equal(stripAppBasePath("/app/api/auth/role"), "/api/auth/role");
  });

  it("leaves already-stripped paths unchanged", () => {
    assert.equal(stripAppBasePath("/calls"), "/calls");
    assert.equal(stripAppBasePath("/"), "/");
  });
});

describe("getPublicPath", () => {
  it("reads the URL pathname including /app", () => {
    assert.equal(getPublicPath({ url: "https://example.com/app/coach" }), "/app/coach");
    assert.equal(getPublicPath({ url: "https://example.com/calls" }), "/calls");
  });
});

describe("route classifiers", () => {
  it("treats sign-in and sign-up as public auth routes with or without /app", () => {
    assert.equal(isPublicAuthRoute("/sign-in"), true);
    assert.equal(isPublicAuthRoute("/app/sign-in"), true);
    assert.equal(isPublicAuthRoute("/app/sign-up/continue"), true);
    assert.equal(isPublicAuthRoute("/app/select-organization"), true);
    assert.equal(isPublicAuthRoute("/app/create-organization"), true);
    assert.equal(isPublicAuthRoute("/app/organization"), true);
    assert.equal(isPublicAuthRoute("/app/user"), true);
    assert.equal(isPublicAuthRoute("/app/accept-invite"), true);
    assert.equal(isPublicAuthRoute("/accept-invite"), true);
    assert.equal(isPublicAuthRoute("/app/subscribe"), true);
    assert.equal(isPublicAuthRoute("/subscribe"), true);
    assert.equal(isPublicAuthRoute("/app/workspaces"), true);
    assert.equal(isPublicAuthRoute("/workspaces"), true);
    assert.equal(isPublicAuthRoute("/app/checkout/success"), true);
    assert.equal(isPublicAuthRoute("/checkout/success"), true);
    assert.equal(isCheckoutPath("/app/checkout/success"), true);
    assert.equal(isCheckoutPath("/checkout"), true);
    assert.equal(isCheckoutPath("/app/coach"), false);
    assert.equal(isPublicAuthRoute("/app/coach"), false);
  });

  it("allows unauthenticated GET /api/auth/role and webhooks", () => {
    assert.equal(isPublicApiRoute("/app/api/auth/role", "GET"), true);
    assert.equal(isPublicApiRoute("/api/auth/role", "GET"), true);
    assert.equal(isPublicApiRoute("/app/api/auth/role", "POST"), false);
    assert.equal(isPublicApiRoute("/app/api/auth/revoke-leaked-session", "GET"), true);
    assert.equal(isPublicApiRoute("/app/api/auth/revoke-leaked-session", "POST"), true);
    assert.equal(isPublicApiRoute("/app/api/auth/revoke-leaked-session", "PUT"), false);
    assert.equal(isPublicApiRoute("/app/api/webhooks/fathom", "POST"), true);
    assert.equal(isPublicApiRoute("/app/api/billing/checkout", "GET"), true);
    assert.equal(isPublicApiRoute("/app/api/billing/checkout", "POST"), true);
    assert.equal(isPublicApiRoute("/app/api/billing/checkout", "PUT"), false);
    assert.equal(isPublicApiRoute("/app/api/billing/stripe-config", "GET"), true);
    assert.equal(isPublicApiRoute("/app/api/billing/stripe-config", "POST"), true);
    assert.equal(isPublicApiRoute("/api/billing/stripe-config", "POST"), true);
    assert.equal(isPublicApiRoute("/app/api/billing/stripe-config", "PUT"), false);
    assert.equal(isPublicApiRoute("/app/__auth/v1/client", "POST"), true);
    assert.equal(isPublicApiRoute("/__auth/v1/client", "POST"), true);
    assert.equal(isPublicApiRoute("/__clerk/npm/@clerk/clerk-js@6/dist/sdk.js", "GET"), true);
    assert.equal(isPublicApiRoute("/app/api/auth/clerk-proxy", "POST"), true);
    assert.equal(isPublicApiRoute("/app/api/calls/upload", "POST"), false);
    assert.equal(isPublicApiRoute("/app/api/marketing/integration-request", "POST"), true);
    assert.equal(isPublicApiRoute("/api/marketing/integration-request", "POST"), true);
    assert.equal(isPublicApiRoute("/app/api/marketing/integration-request", "GET"), false);
    assert.equal(isPublicApiRoute("/app/api/visitor-company", "GET"), true);
    assert.equal(isPublicApiRoute("/api/visitor-company", "GET"), true);
    assert.equal(isPublicApiRoute("/app/api/visitor-company", "HEAD"), true);
    assert.equal(isPublicApiRoute("/app/api/visitor-company", "POST"), false);
    assert.equal(isPublicApiRoute("/app/api/integrations", "POST"), false);
  });

  it("detects API routes after stripping the base path", () => {
    assert.equal(isApiRoute("/app/api/auth/role"), true);
    assert.equal(isApiRoute("/api/admin/keys"), true);
    assert.equal(isApiRoute("/app/coach"), false);
  });

  it("detects bare /calls that must be redirected onto the worker", () => {
    assert.equal(isBareCallsPath("/calls"), true);
    assert.equal(isBareCallsPath("/calls/abc"), true);
    assert.equal(isBareCallsPath("/app/calls"), false);
    assert.equal(isApexFaviconPath("/favicon.ico"), true);
    assert.equal(isApexFaviconPath("/icon.svg"), true);
    assert.equal(isApexFaviconPath("/app/icon.svg"), false);
    assert.equal(isApexPricingPath("/pricing"), true);
    assert.equal(isApexPricingPath("/pricing/"), true);
    assert.equal(isApexPricingPath("/app/pricing"), false);
    assert.equal(APP_BASE_PATH, "/app");
  });

  it("treats apex / and /app/marketing as public, but not the /app dashboard", () => {
    assert.equal(isPublicMarketingPath("/"), true);
    assert.equal(isPublicMarketingPath("/app/marketing"), true);
    assert.equal(isPublicMarketingPath("/marketing"), true);
    assert.equal(isPublicMarketingPath("/app"), false);
    assert.equal(isPublicMarketingPath("/app/"), false);
    assert.equal(isPublicMarketingPath("/app/coach"), false);
    assert.equal(isMarketingAppPath("/marketing"), true);
    assert.equal(isMarketingAppPath("/app/marketing"), true);
    assert.equal(isMarketingAppPath("/"), false);
    assert.equal(isPublicMarketingPath("/integrations"), true);
    assert.equal(isPublicMarketingPath("/integrations/"), true);
    assert.equal(isPublicMarketingPath("/app/integrations"), true);
    assert.equal(isPublicMarketingPath("/app/integrations/"), true);
    assert.equal(isMarketingAppPath("/integrations"), true);
    assert.equal(isMarketingAppPath("/app/integrations"), true);
    assert.equal(isPublicMarketingPath("/app/api/marketing/integration-request"), false);
    assert.equal(isPublicMarketingPath("/privacy"), true);
    assert.equal(isPublicMarketingPath("/privacy/"), true);
    assert.equal(isPublicMarketingPath("/app/privacy"), true);
    assert.equal(isPublicMarketingPath("/app/privacy/"), true);
    assert.equal(isMarketingAppPath("/privacy"), true);
    assert.equal(isMarketingAppPath("/app/privacy"), true);
    assert.equal(isPublicMarketingPath("/privacy/notes"), false);
    assert.equal(isPublicMarketingPath("/robots.txt"), true);
    assert.equal(isPublicMarketingPath("/app/robots.txt"), true);
    assert.equal(isPublicMarketingPath("/sitemap.xml"), true);
    assert.equal(isPublicMarketingPath("/app/sitemap.xml"), true);
    assert.equal(isPublicDocumentPath("/app/robots.txt"), true);
    assert.equal(isPublicMarketingPath("/app/site-missing"), true);
    assert.equal(isPublicMarketingPath("/site-missing"), true);
    assert.equal(isPublicMarketingPath("/app/calls"), false);
  });

  it("redirects apex /calls, /favicon.ico, and /pricing", () => {
    const calls = getApexAliasRedirect("https://example.com/calls?rep=1");
    assert.equal(calls?.status, 308);
    assert.equal(calls?.location, "https://example.com/app/calls?rep=1");

    const nested = getApexAliasRedirect("https://example.com/calls/abc");
    assert.equal(nested?.location, "https://example.com/app/calls/abc");

    const icon = getApexAliasRedirect("https://example.com/favicon.ico");
    assert.equal(icon?.location, "https://example.com/app/icon.svg");

    const bareIcon = getApexAliasRedirect("https://example.com/icon.svg");
    assert.equal(bareIcon?.location, "https://example.com/app/icon.svg");

    const pricing = getApexAliasRedirect("https://example.com/pricing");
    assert.equal(pricing?.status, 308);
    assert.equal(pricing?.location, "https://example.com/#pricing");

    const handshake = getApexAliasRedirect(
      "https://refreshqueue.com/__auth/v1/client/handshake?redirect_url=https%3A%2F%2Frefreshqueue.com%2Fapp%2Fmarketing"
    );
    assert.equal(handshake?.status, 307);
    assert.equal(
      handshake?.location,
      "https://refreshqueue.com/app/__auth/v1/client/handshake?redirect_url=https%3A%2F%2Frefreshqueue.com%2Fapp%2Fmarketing"
    );

    assert.equal(getApexAliasRedirect("https://example.com/"), null);
    assert.equal(getApexAliasRedirect("https://example.com/app/calls"), null);
    assert.equal(getApexAliasRedirect("https://example.com/app/coach"), null);
  });

  it("rewrites apex / to /app/marketing without changing other paths", () => {
    assert.equal(
      getApexMarketingRewrite("https://example.com/?utm=1"),
      "https://example.com/app/marketing?utm=1"
    );
    assert.equal(getApexMarketingRewrite("https://example.com/"), "https://example.com/app/marketing");
    assert.equal(getApexMarketingRewrite("https://example.com/app"), null);
    assert.equal(getApexMarketingRewrite("https://example.com/app/marketing"), null);
    assert.equal(getApexMarketingRewrite("https://example.com/pricing"), null);
    assert.equal(getApexMarketingRewrite("https://example.com/integrations"), null);
  });

  it("rewrites apex /integrations to /app/integrations", () => {
    assert.equal(
      getApexIntegrationsRewrite("https://refreshqueue.com/integrations?from=nav"),
      "https://refreshqueue.com/app/integrations?from=nav"
    );
    assert.equal(
      getApexIntegrationsRewrite("https://refreshqueue.com/integrations/"),
      "https://refreshqueue.com/app/integrations"
    );
    assert.equal(getApexIntegrationsRewrite("https://refreshqueue.com/"), null);
    assert.equal(getApexIntegrationsRewrite("https://refreshqueue.com/app/integrations"), null);
    assert.equal(getApexIntegrationsRewrite("https://refreshqueue.com/integrations/fathom.png"), null);
  });

  it("rewrites apex /privacy, robots.txt, and sitemap.xml onto the app", () => {
    assert.equal(
      getApexPrivacyRewrite("https://refreshqueue.com/privacy?from=footer"),
      "https://refreshqueue.com/app/privacy?from=footer"
    );
    assert.equal(getApexPrivacyRewrite("https://refreshqueue.com/privacy/"), "https://refreshqueue.com/app/privacy");
    assert.equal(getApexContentRewrite("https://refreshqueue.com/robots.txt"), "https://refreshqueue.com/app/robots.txt");
    assert.equal(
      getApexContentRewrite("https://refreshqueue.com/sitemap.xml"),
      "https://refreshqueue.com/app/sitemap.xml"
    );
    assert.equal(getApexPrivacyRewrite("https://refreshqueue.com/"), null);
    assert.equal(getApexContentRewrite("https://refreshqueue.com/privacy/extra"), null);
  });

  it("keeps query strings on the home page and does not redirect twice", () => {
    const home = apexWorkerAction("https://refreshqueue.com/?utm_source=x");
    assert.deepEqual(home, { type: "rewrite", url: "https://refreshqueue.com/app/marketing?utm_source=x" });
    assert.equal(apexWorkerAction("https://refreshqueue.com/").type, "rewrite");

    const samples = [
      "https://refreshqueue.com/",
      "https://refreshqueue.com/?utm_source=x",
      "https://refreshqueue.com/pricing",
      "https://refreshqueue.com/pricing/",
      "https://refreshqueue.com/pricing?plan=coach",
      "https://refreshqueue.com/calls?rep=1",
      "https://refreshqueue.com/calls/abc",
      "https://refreshqueue.com/integrations",
      "https://refreshqueue.com/integrations/",
      "https://refreshqueue.com/privacy",
      "https://refreshqueue.com/privacy/",
      "https://refreshqueue.com/robots.txt",
      "https://refreshqueue.com/sitemap.xml",
      "https://refreshqueue.com/favicon.ico",
      "https://refreshqueue.com/icon.svg",
      "https://refreshqueue.com/app",
      "https://refreshqueue.com/app/calls",
      "https://refreshqueue.com/app/marketing",
      "https://refreshqueue.com/__auth/v1/client",
      "https://refreshqueue.com/old-static-page",
      "https://refreshqueue.com/integrations/fathom.png",
    ];
    for (const start of samples) {
      const first = apexWorkerAction(start);
      if (first.type !== "redirect") continue;
      const nextUrl = first.location.split("#")[0];
      const second = apexWorkerAction(nextUrl);
      assert.notEqual(second.type, "redirect", `${start} -> ${first.location}`);
    }

    const pricing = apexWorkerAction("https://refreshqueue.com/pricing");
    assert.deepEqual(pricing, { type: "redirect", location: "https://refreshqueue.com/#pricing", status: 308 });
    assert.equal(apexWorkerAction("https://refreshqueue.com/#pricing").type, "rewrite");

    const missing = apexWorkerAction("https://refreshqueue.com/old-static-page?utm_source=x");
    assert.deepEqual(missing, { type: "not-found", url: "https://refreshqueue.com/app/site-missing" });
    assert.equal(apexWorkerAction(missing.type === "not-found" ? missing.url : "").type, "passthrough");
    assert.equal(getApexNotFoundRewrite("https://refreshqueue.com/"), null);
    assert.equal(getApexNotFoundRewrite("https://refreshqueue.com/?utm_source=x"), null);
    assert.equal(getApexNotFoundRewrite("https://refreshqueue.com/app/calls"), null);
    assert.equal(getApexNotFoundRewrite("https://refreshqueue.com/privacy"), null);
    assert.equal(apexWorkerAction("https://refreshqueue.com/integrations/fathom.png").type, "not-found");
    assert.equal(apexWorkerAction("https://refreshqueue.com/app/icon.svg").type, "passthrough");
  });

  it("routes the whole apex through one worker pattern and lists /privacy in the sitemap", () => {
    const wrangler = readFileSync(new URL("../../wrangler.jsonc", import.meta.url), "utf8");
    const patterns = [...wrangler.matchAll(/"pattern":\s*"([^"]+)"/g)].map((match) => match[1]);
    assert.deepEqual(patterns, ["refreshqueue.com/*"]);
    const worker = readFileSync(new URL("../../cloudflare/worker.js", import.meta.url), "utf8");
    assert.match(worker, /apexWorkerAction/);
    assert.equal(worker.indexOf("apexWorkerAction") < worker.indexOf("isClerkProxyPath(pathname)"), true);
    const nextConfig = readFileSync(new URL("../../next.config.ts", import.meta.url), "utf8");
    assert.match(nextConfig, /source: "\/pricing"/);
    assert.match(nextConfig, /destination: "\/#pricing"/);
    assert.match(nextConfig, /source: "\/privacy"/);
    assert.doesNotMatch(nextConfig, /destination: "\/pricing"/);
    assert.deepEqual([...PUBLIC_SITEMAP_PATHS], ["/", "/integrations", "/privacy"]);
    const sitemap = readFileSync(new URL("../app/sitemap.ts", import.meta.url), "utf8");
    const robots = readFileSync(new URL("../app/robots.ts", import.meta.url), "utf8");
    assert.match(sitemap, /PUBLIC_SITEMAP_PATHS/);
    assert.match(robots, /sitemap\.xml/);
    assert.match(robots, /allow: "\/"/);
    const middleware = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");
    assert.doesNotMatch(middleware, /"\/favicon\.ico"/);
    assert.doesNotMatch(middleware, /"\/icon\.svg"/);
  });
});

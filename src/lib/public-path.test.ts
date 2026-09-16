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
  getApexAliasRedirect,
  getApexMarketingRewrite,
} from "./public-path";

describe("toAppPath", () => {
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
    assert.equal(isPublicAuthRoute("/app/coach"), false);
  });

  it("allows unauthenticated GET /api/auth/role and webhooks", () => {
    assert.equal(isPublicApiRoute("/app/api/auth/role", "GET"), true);
    assert.equal(isPublicApiRoute("/api/auth/role", "GET"), true);
    assert.equal(isPublicApiRoute("/app/api/auth/role", "POST"), false);
    assert.equal(isPublicApiRoute("/app/api/webhooks/fathom", "POST"), true);
    assert.equal(isPublicApiRoute("/app/api/calls/upload", "POST"), false);
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
  });
});

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
    assert.equal(getPublicPath({ url: "https://refreshqueue.com/app/coach" }), "/app/coach");
    assert.equal(getPublicPath({ url: "https://refreshqueue.com/calls" }), "/calls");
  });
});

describe("route classifiers", () => {
  it("treats sign-in and sign-up as public auth routes with or without /app", () => {
    assert.equal(isPublicAuthRoute("/sign-in"), true);
    assert.equal(isPublicAuthRoute("/app/sign-in"), true);
    assert.equal(isPublicAuthRoute("/app/sign-up/continue"), true);
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
    assert.equal(isApexFaviconPath("/app/icon.svg"), false);
    assert.equal(APP_BASE_PATH, "/app");
  });
});

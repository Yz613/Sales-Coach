import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  LOCAL_TENANT_ID,
  TenantRequiredError,
  bindTenant,
  currentTenantId,
  resolveTenantId,
  runWithTenant,
  settingStorageKey,
} from "./tenant";

describe("resolveTenantId", () => {
  it("uses the local workspace when Clerk is off", () => {
    assert.equal(resolveTenantId({ isClerkConfigured: false, orgId: null }), LOCAL_TENANT_ID);
  });

  it("never falls back to a shared workspace bucket", () => {
    assert.throws(
      () => resolveTenantId({ isClerkConfigured: true, orgId: null }),
      TenantRequiredError
    );
    assert.throws(
      () => resolveTenantId({ isClerkConfigured: true, orgId: "workspace" }),
      TenantRequiredError
    );
    assert.equal(resolveTenantId({ isClerkConfigured: true, orgId: "org_locked" }), "org_locked");
  });
});

describe("runWithTenant", () => {
  it("scopes currentTenantId to the active org", () => {
    runWithTenant("org_a", () => {
      assert.equal(currentTenantId(), "org_a");
    });
    assert.equal(settingStorageKey("org_a", "ai_api_key"), "t:org_a:ai_api_key");
  });
});

describe("bindTenant", () => {
  it("does not throw when attaching a tenant", () => {
    assert.doesNotThrow(() => bindTenant("org_bound"));
  });
});

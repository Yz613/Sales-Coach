import assert from "node:assert/strict";
import { resolveUserRole } from "./roles";

assert.equal(
  resolveUserRole({ clerkConfigured: false, userId: null }),
  "admin",
  "local/no-clerk defaults to admin"
);

assert.equal(
  resolveUserRole({
    clerkConfigured: true,
    userId: "user_1",
  }),
  "member",
  "signed-in Clerk user without role defaults to member"
);

assert.equal(
  resolveUserRole({
    clerkConfigured: true,
    userId: "user_1",
    cookieRole: "admin",
    orgRole: "org:member",
  }),
  "admin",
  "preview cookie wins over org role"
);

assert.equal(
  resolveUserRole({
    clerkConfigured: true,
    userId: "user_1",
    orgRole: "org:admin",
    metadataRole: "member",
  }),
  "admin",
  "org admin wins over metadata member"
);

assert.equal(
  resolveUserRole({
    clerkConfigured: true,
    userId: "user_1",
    hasOrgAdmin: true,
    orgRole: "org:member",
  }),
  "admin",
  "has({ role: org:admin }) grants admin even if orgRole string is stale"
);

assert.equal(
  resolveUserRole({
    clerkConfigured: true,
    userId: "user_1",
    orgRole: "org:member",
    metadataRole: "admin",
  }),
  "member",
  "active org member is not elevated by leftover user metadata"
);

assert.equal(
  resolveUserRole({
    clerkConfigured: true,
    userId: "user_1",
    metadataRole: "admin",
  }),
  "admin",
  "metadata admin is used when no organization is active"
);

console.log("resolveUserRole checks passed");

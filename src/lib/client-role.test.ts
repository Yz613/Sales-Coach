import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  clerkOrgRole,
  initialClientRoleMemory,
  reduceClientRole,
  type ClientRoleEvent,
  type ClientRoleMemory,
} from "./client-role";

function step(memory: ClientRoleMemory, event: ClientRoleEvent) {
  return reduceClientRole(memory, event);
}

describe("clerk organization role", () => {
  it("prefers the active membership role, then the session org role", () => {
    assert.equal(
      clerkOrgRole({ authOrgRole: "org:member", orgLoaded: true, membershipRole: "org:admin" }),
      "org:admin"
    );
    assert.equal(
      clerkOrgRole({ authOrgRole: "org:admin", orgLoaded: false, membershipRole: "org:member" }),
      "org:admin"
    );
    assert.equal(clerkOrgRole({ authOrgRole: "", orgLoaded: true, membershipRole: null }), null);
  });
});

describe("client role follows the active Clerk organization", () => {
  it("does not paint the member nav for an admin leaving a public page", () => {
    let memory = initialClientRoleMemory("member", false);
    const waiting = step(memory, {
      initialRole: "member",
      trustServerRole: false,
      clerkConfigured: true,
      authLoaded: false,
      orgLoaded: false,
      userId: null,
      orgRole: null,
    });
    assert.equal(waiting.isLoading, true);
    assert.equal(waiting.role, "member");

    memory = waiting.memory;
    const admin = step(memory, {
      initialRole: "member",
      trustServerRole: false,
      clerkConfigured: true,
      authLoaded: true,
      orgLoaded: true,
      userId: "user_admin",
      orgRole: "org:admin",
      hasOrgAdmin: true,
    });
    assert.equal(admin.role, "admin");
    assert.equal(admin.isLoading, false);

    memory = admin.memory;
    const stillAdmin = step(memory, {
      initialRole: "member",
      trustServerRole: false,
      clerkConfigured: true,
      authLoaded: true,
      orgLoaded: true,
      userId: "user_admin",
      orgRole: "org:admin",
      hasOrgAdmin: true,
    });
    assert.equal(stillAdmin.role, "admin");
    assert.deepEqual(stillAdmin.memory, admin.memory);
  });

  it("maps org:member and a stale has({ role: org:admin }) through resolveUserRole", () => {
    const member = step(initialClientRoleMemory("member", false), {
      initialRole: "member",
      trustServerRole: false,
      clerkConfigured: true,
      authLoaded: true,
      orgLoaded: true,
      userId: "user_member",
      orgRole: "org:member",
    });
    assert.equal(member.role, "member");
    assert.equal(member.isLoading, false);

    const elevated = step(member.memory, {
      initialRole: "member",
      trustServerRole: false,
      clerkConfigured: true,
      authLoaded: true,
      orgLoaded: false,
      userId: "user_member",
      orgRole: "org:member",
      hasOrgAdmin: true,
    });
    assert.equal(elevated.role, "admin");
    assert.equal(elevated.isLoading, false);
  });

  it("loads instead of flashing member while the active organization changes", () => {
    const admin = step(initialClientRoleMemory("member", false), {
      initialRole: "member",
      trustServerRole: false,
      clerkConfigured: true,
      authLoaded: true,
      orgLoaded: true,
      userId: "user_admin",
      orgRole: "org:admin",
    });
    const switching = step(admin.memory, {
      initialRole: "member",
      trustServerRole: false,
      clerkConfigured: true,
      authLoaded: false,
      orgLoaded: false,
      userId: "user_admin",
      orgRole: null,
    });
    assert.equal(switching.isLoading, true);
    assert.equal(switching.role, "admin");

    const nextTeam = step(switching.memory, {
      initialRole: "member",
      trustServerRole: false,
      clerkConfigured: true,
      authLoaded: true,
      orgLoaded: true,
      userId: "user_admin",
      orgRole: "org:member",
    });
    assert.equal(nextTeam.role, "member");
    assert.equal(nextTeam.isLoading, false);
  });

  it("shows a server-rendered admin immediately and adopts a new server role", () => {
    const first = step(initialClientRoleMemory("admin", true), {
      initialRole: "admin",
      trustServerRole: true,
      clerkConfigured: true,
      authLoaded: false,
      orgLoaded: false,
    });
    assert.equal(first.role, "admin");
    assert.equal(first.isLoading, false);

    const confirmed = step(first.memory, {
      initialRole: "admin",
      trustServerRole: true,
      clerkConfigured: true,
      authLoaded: true,
      orgLoaded: true,
      userId: "user_admin",
      orgRole: "org:admin",
    });
    assert.equal(confirmed.role, "admin");

    const demoted = step(confirmed.memory, {
      initialRole: "member",
      trustServerRole: true,
      clerkConfigured: true,
      authLoaded: true,
      orgLoaded: true,
      userId: "user_admin",
      orgRole: "org:admin",
    });
    assert.equal(demoted.role, "member");
    assert.equal(demoted.isLoading, false);
  });

  it("ignores a public guest role after Clerk has resolved an admin", () => {
    const admin = step(initialClientRoleMemory("member", false), {
      initialRole: "member",
      trustServerRole: false,
      clerkConfigured: true,
      authLoaded: true,
      orgLoaded: true,
      userId: "user_admin",
      orgRole: "org:admin",
    });
    const guestAgain = step(admin.memory, {
      initialRole: "member",
      trustServerRole: false,
      clerkConfigured: true,
      authLoaded: true,
      orgLoaded: true,
      userId: "user_admin",
      orgRole: "org:admin",
    });
    assert.equal(guestAgain.role, "admin");

    const untrustedChange = step(admin.memory, {
      initialRole: "admin",
      trustServerRole: false,
      clerkConfigured: true,
      authLoaded: true,
      orgLoaded: true,
      userId: "user_admin",
      orgRole: "org:admin",
    });
    assert.equal(untrustedChange.role, "admin");
  });

  it("keeps the local role when Clerk is not configured", () => {
    const local = step(initialClientRoleMemory("admin", true), {
      initialRole: "admin",
      trustServerRole: true,
      clerkConfigured: false,
      authLoaded: false,
      orgLoaded: false,
    });
    assert.equal(local.role, "admin");
    assert.equal(local.isLoading, false);

    const updated = step(local.memory, {
      initialRole: "member",
      trustServerRole: true,
      clerkConfigured: false,
      authLoaded: false,
      orgLoaded: false,
    });
    assert.equal(updated.role, "member");
    assert.equal(updated.isLoading, false);
  });

  it("waits for the organization hook when the session has no role yet", () => {
    const waiting = step(initialClientRoleMemory("member", false), {
      initialRole: "member",
      trustServerRole: false,
      clerkConfigured: true,
      authLoaded: true,
      orgLoaded: false,
      userId: "user_admin",
      orgRole: null,
      hasOrgAdmin: false,
    });
    assert.equal(waiting.isLoading, true);

    const resolved = step(waiting.memory, {
      initialRole: "member",
      trustServerRole: false,
      clerkConfigured: true,
      authLoaded: true,
      orgLoaded: true,
      userId: "user_admin",
      orgRole: null,
    });
    assert.equal(resolved.role, "member");
    assert.equal(resolved.isLoading, false);
  });
});

describe("client role wiring", () => {
  it("reads Clerk org membership in the provider and gates the member sidebar", () => {
    const provider = readFileSync(new URL("../components/AuthProvider.tsx", import.meta.url), "utf8");
    assert.match(provider, /useAuth\(/);
    assert.match(provider, /useOrganization\(/);
    assert.match(provider, /clerkOrgRole\(/);
    assert.match(provider, /has\?\.\(\{ role: "org:admin" \}\)/);

    const context = readFileSync(new URL("./auth-context.tsx", import.meta.url), "utf8");
    assert.match(context, /reduceClientRole\(/);
    assert.equal(context.includes("useState<UserRole>(initialRole)"), false);
    assert.equal(context.includes("skipRoleFetch || clerkUser?.id"), false);

    const nav = readFileSync(new URL("../components/Navigation.tsx", import.meta.url), "utf8");
    assert.match(nav, /authLoading\s*\?\s*\[\]/);
    assert.match(nav, /authLoading \? "Loading"/);
  });
});

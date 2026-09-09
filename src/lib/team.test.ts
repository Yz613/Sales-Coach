import assert from "node:assert/strict";
import { parseInviteRole, publicTeamError } from "./team-copy";

assert.equal(parseInviteRole("org:admin"), "org:admin");
assert.equal(parseInviteRole("org:member"), "org:member");
assert.equal(parseInviteRole("admin"), "org:member");
assert.equal(parseInviteRole(undefined), "org:member");

assert.equal(
  publicTeamError(new Error("Clerk Organizations are not enabled")),
  "Teams are not enabled"
);
assert.equal(publicTeamError(new Error("Something else")), "Something else");

console.log("team helper checks passed");

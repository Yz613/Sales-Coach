import assert from "node:assert/strict";
import { memberDisplayName, memberRoleChangeError, sortTeamMembers, type TeamMember } from "./teamRoster";

assert.equal(memberDisplayName({ firstName: "Alex", lastName: "Kim", email: "alex@team.com" }), "Alex Kim");
assert.equal(memberDisplayName({ email: "alex@team.com" }), "alex@team.com");
assert.equal(memberDisplayName({}), "Teammate");

const members: TeamMember[] = [
  { userId: "user_b", email: "sam@team.com", name: "Sam", role: "org:member" },
  { userId: "user_a", email: "alex@team.com", name: "Alex", role: "org:admin" },
];
assert.deepEqual(
  sortTeamMembers(members).map((member) => member.userId),
  ["user_a", "user_b"]
);

assert.equal(memberRoleChangeError(members, "user_a", "org:member"), "Keep at least one admin on the team.");
assert.equal(memberRoleChangeError(members, "user_b", "org:admin"), null);
assert.equal(
  memberRoleChangeError(
    [...members, { userId: "user_c", email: "jo@team.com", name: "Jo", role: "org:admin" }],
    "user_a",
    "org:member"
  ),
  null
);
assert.equal(memberRoleChangeError(members, "missing", "org:member"), "That person is not on the team.");

console.log("team roster checks passed");

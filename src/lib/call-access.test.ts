import assert from "node:assert/strict";
import {
  canViewCall,
  filterCallsForViewer,
  isOwnRep,
  resolveCanViewAllCalls,
} from "./call-access";

const alex = { id: "r1", name: "Alex Rivera", email: "alex@team.com" };
const sam = { id: "r2", name: "Sam Chen", email: "sam@team.com" };
const calls = [
  { id: "c1", repId: "r1", repName: "Alex Rivera" },
  { id: "c2", repId: "r2", repName: "Sam Chen" },
];

assert.equal(isOwnRep(alex, { canViewAllCalls: false, email: "alex@team.com" }), true);
assert.equal(isOwnRep(sam, { canViewAllCalls: false, email: "alex@team.com" }), false);
assert.equal(isOwnRep(alex, { canViewAllCalls: false, name: "Alex Rivera" }), true);
assert.equal(
  isOwnRep({ name: "Alex Rivera" }, { canViewAllCalls: false, email: "alex.rivera@team.com" }),
  true,
  "email local-part matches rep name"
);

assert.deepEqual(
  filterCallsForViewer(calls, [alex, sam], { canViewAllCalls: true, email: "alex@team.com" }).map(
    (c) => c.id
  ),
  ["c1", "c2"]
);

assert.deepEqual(
  filterCallsForViewer(calls, [alex, sam], { canViewAllCalls: false, email: "alex@team.com" }).map(
    (c) => c.id
  ),
  ["c1"]
);

assert.equal(
  canViewCall(calls[1], [alex, sam], { canViewAllCalls: false, email: "alex@team.com" }),
  false
);

assert.equal(
  resolveCanViewAllCalls({
    clerkConfigured: true,
    userId: "user_1",
    orgRole: "org:member",
    isAdmin: true,
  }),
  false,
  "org members cannot elevate via preview cookie"
);

assert.equal(
  resolveCanViewAllCalls({
    clerkConfigured: true,
    userId: "user_1",
    orgRole: "org:admin",
    hasOrgAdmin: true,
    isAdmin: false,
  }),
  false,
  "org admin previewing as member sees only their calls"
);

assert.equal(
  resolveCanViewAllCalls({
    clerkConfigured: true,
    userId: "user_1",
    orgRole: "org:admin",
    hasOrgAdmin: true,
    isAdmin: true,
  }),
  true
);

assert.equal(
  resolveCanViewAllCalls({ clerkConfigured: false, userId: null, isAdmin: true }),
  true,
  "local admin sees all calls"
);

console.log("call-access checks passed");

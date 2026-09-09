import assert from "node:assert/strict";
import { parseInviteEmails } from "./inviteEmails";

assert.deepEqual(parseInviteEmails(""), []);
assert.deepEqual(parseInviteEmails("  "), []);
assert.deepEqual(parseInviteEmails("not-an-email"), []);
assert.deepEqual(parseInviteEmails("alex@team.com"), ["alex@team.com"]);
assert.deepEqual(
  parseInviteEmails("alex@team.com, sam@team.com; pat@team.com"),
  ["alex@team.com", "sam@team.com", "pat@team.com"]
);
assert.deepEqual(
  parseInviteEmails("alex@team.com\nsam@team.com  alex@team.com"),
  ["alex@team.com", "sam@team.com"]
);
assert.deepEqual(parseInviteEmails("Alex@team.com, alex@team.com"), ["Alex@team.com"]);

console.log("parseInviteEmails checks passed");

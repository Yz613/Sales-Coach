import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  LEAKED_HANDSHAKE_REVOKED_SETTING,
  LEAKED_HANDSHAKE_SESSION_ID,
  LEAKED_HANDSHAKE_USER_ID,
  clerkSessionRevokeUrl,
  clerkUserSessionsUrl,
  parseClerkSessionList,
} from "./clerkSessions";

describe("clerk session revoke helpers", () => {
  it("builds Clerk Backend session URLs", () => {
    assert.equal(
      clerkSessionRevokeUrl(LEAKED_HANDSHAKE_SESSION_ID),
      `https://api.clerk.com/v1/sessions/${LEAKED_HANDSHAKE_SESSION_ID}/revoke`
    );
    assert.equal(
      clerkUserSessionsUrl(LEAKED_HANDSHAKE_USER_ID),
      `https://api.clerk.com/v1/sessions?user_id=${LEAKED_HANDSHAKE_USER_ID}&status=active`
    );
    assert.equal(LEAKED_HANDSHAKE_REVOKED_SETTING, "clerk:leaked_handshake_revoked");
  });

  it("reads session ids from list or data wrappers", () => {
    assert.deepEqual(parseClerkSessionList([{ id: "sess_a" }]).map((s) => s.id), ["sess_a"]);
    assert.deepEqual(parseClerkSessionList({ data: [{ id: "sess_b" }] }).map((s) => s.id), ["sess_b"]);
    assert.deepEqual(parseClerkSessionList({}), []);
  });
});

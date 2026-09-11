import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ACCEPT_INVITE_PATH,
  acceptInvitePath,
  buildInviteRedirectUrl,
  getInviteTicketRedirect,
} from "./inviteRedirect";

describe("invite redirect URLs", () => {
  it("builds an absolute /app/accept-invite URL from the API request origin", () => {
    assert.equal(ACCEPT_INVITE_PATH, "/accept-invite");
    assert.equal(acceptInvitePath(), "/app/accept-invite");
    assert.equal(
      buildInviteRedirectUrl("https://refreshqueue.com/app/api/invites"),
      "https://refreshqueue.com/app/accept-invite"
    );
  });

  it("moves stray invite tickets onto the accept page without caching", () => {
    const moved = getInviteTicketRedirect(
      "https://refreshqueue.com/app?__clerk_ticket=abc&__clerk_status=sign_up"
    );
    assert.equal(moved?.status, 307);
    assert.equal(
      moved?.location,
      "https://refreshqueue.com/app/accept-invite?__clerk_ticket=abc&__clerk_status=sign_up"
    );
  });

  it("leaves tickets already on public auth routes alone", () => {
    assert.equal(
      getInviteTicketRedirect(
        "https://refreshqueue.com/app/accept-invite?__clerk_ticket=abc"
      ),
      null
    );
    assert.equal(
      getInviteTicketRedirect("https://refreshqueue.com/app/sign-up?__clerk_ticket=abc"),
      null
    );
    assert.equal(getInviteTicketRedirect("https://refreshqueue.com/app/calls"), null);
  });
});

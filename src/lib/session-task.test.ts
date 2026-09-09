import assert from "node:assert/strict";
import { pendingTeamSelectionPath } from "./session-task";

assert.equal(
  pendingTeamSelectionPath({ sessionStatus: "active", publicPath: "/app" }),
  null,
  "active sessions are not redirected"
);

assert.equal(
  pendingTeamSelectionPath({ sessionStatus: "pending", publicPath: "/app" }),
  "/app/select-organization",
  "pending session on the dashboard must finish team selection"
);

assert.equal(
  pendingTeamSelectionPath({ sessionStatus: "pending", publicPath: "/app/calls" }),
  "/app/select-organization"
);

assert.equal(
  pendingTeamSelectionPath({ sessionStatus: "pending", publicPath: "/app/select-organization" }),
  null,
  "already on the team picker"
);

assert.equal(
  pendingTeamSelectionPath({ sessionStatus: "pending", publicPath: "/app/sign-in" }),
  "/app/select-organization",
  "pending sessions should finish team selection instead of looping on sign-in"
);

assert.equal(
  pendingTeamSelectionPath({ sessionStatus: "pending", publicPath: "/app/api/team" }),
  "/app/select-organization"
);

console.log("pendingTeamSelectionPath checks passed");

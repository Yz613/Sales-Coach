export type WorkspaceMenuItem = {
  id: string;
  name: string;
  role: string;
  current: boolean;
  access: "included" | "paid" | "unpaid" | "unavailable";
};

/** Selecting a team never grants access; the destination enforces its verified entitlement. */
export function workspaceMenuDestination(access: WorkspaceMenuItem["access"]): string {
  return access === "unpaid" ? "/subscribe" : "/";
}

export function workspaceAccessLabel(access: WorkspaceMenuItem["access"]): string {
  switch (access) {
    case "included": return "Full access · No payment needed";
    case "paid": return "Subscription active";
    case "unpaid": return "Choose a plan to use this team";
    case "unavailable": return "We couldn’t check access. Try opening the team again.";
  }
}

export type TeamInviteRole = "org:member" | "org:admin";

export type TeamInfo = {
  id: string;
  name: string;
  role: string;
};

export type PendingInvite = {
  id: string;
  emailAddress: string;
  role: string;
};

export function parseInviteRole(value: unknown): TeamInviteRole {
  return value === "org:admin" ? "org:admin" : "org:member";
}

/** Strip vendor wording from errors shown in the invite UI. */
export function publicTeamError(err: unknown): string {
  const raw = err instanceof Error ? err.message : "Something went wrong";
  const cleaned = raw
    .replace(/\bClerk Organizations?\b/gi, "Teams")
    .replace(/\bclerk\b/gi, "")
    .replace(/\borganizations?\b/gi, "team")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "Something went wrong";
}

import type { InviteRole } from "./inviteEmails";

export type TeamMember = {
  userId: string;
  email: string;
  name: string;
  role: string;
};

export function memberDisplayName(input: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}): string {
  const name = [input.firstName, input.lastName]
    .map((part) => part?.trim() || "")
    .filter(Boolean)
    .join(" ");
  return name || input.email?.trim() || "Teammate";
}

export function sortTeamMembers(members: TeamMember[]): TeamMember[] {
  return [...members].sort((a, b) => {
    if (a.role !== b.role) return a.role === "org:admin" ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

/** Block demoting the last admin so the team cannot lock itself out. */
export function memberRoleChangeError(
  members: Pick<TeamMember, "userId" | "role">[],
  userId: string,
  nextRole: InviteRole
): string | null {
  const target = members.find((member) => member.userId === userId);
  if (!target) return "That person is not on the team.";
  if (nextRole !== "org:member" || target.role !== "org:admin") return null;
  const adminCount = members.filter((member) => member.role === "org:admin").length;
  if (adminCount <= 1) return "Keep at least one admin on the team.";
  return null;
}

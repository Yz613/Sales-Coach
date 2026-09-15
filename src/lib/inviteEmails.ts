const EMAIL_SPLIT = /[\s,;]+/;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const INVITE_ROLES = ["org:admin", "org:member"] as const;
export type InviteRole = (typeof INVITE_ROLES)[number];

/** Split pasted emails on commas, spaces, or newlines and keep unique valid addresses. */
export function parseInviteEmails(input: string): string[] {
  const seen = new Set<string>();
  const emails: string[] = [];
  for (const part of input.split(EMAIL_SPLIT)) {
    const email = part.trim();
    if (!email) continue;
    const key = email.toLowerCase();
    if (seen.has(key) || !EMAIL_SHAPE.test(email)) continue;
    seen.add(key);
    emails.push(email);
  }
  return emails;
}

export function isInviteRole(value: unknown): value is InviteRole {
  return value === "org:admin" || value === "org:member";
}

export function inviteRoleLabel(role?: string | null): string {
  if (role === "org:admin") return "Admin";
  if (role === "org:member") return "Member";
  return role?.replace(/^org:/, "") || role || "";
}

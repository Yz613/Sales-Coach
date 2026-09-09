const EMAIL_SPLIT = /[\s,;]+/;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

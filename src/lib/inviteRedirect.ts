import { isPublicAuthRoute, toAppPath } from "./public-path";

export type InviteTicketRedirect = {
  location: string;
  status: 307;
};

/** Public path where invite tickets are consumed. */
export const ACCEPT_INVITE_PATH = "/accept-invite";

export function acceptInvitePath(): string {
  return toAppPath(ACCEPT_INVITE_PATH);
}

/**
 * Absolute URL Clerk should send invitees to after they open the ticket link.
 * Must live under `/app` so the Worker (not the marketing homepage) handles it.
 */
export function buildInviteRedirectUrl(requestUrl: string): string {
  const origin = new URL(requestUrl).origin;
  return new URL(acceptInvitePath(), origin).href;
}

/**
 * If an invite ticket landed on a protected app URL, send it to the accept page
 * before auth middleware strips the query string.
 */
export function getInviteTicketRedirect(requestUrl: string): InviteTicketRedirect | null {
  const url = new URL(requestUrl);
  if (!url.searchParams.has("__clerk_ticket")) return null;
  if (isPublicAuthRoute(url.pathname)) return null;
  const dest = new URL(acceptInvitePath(), url.origin);
  dest.search = url.search;
  dest.hash = url.hash;
  if (dest.href === url.href) return null;
  return { location: dest.href, status: 307 };
}

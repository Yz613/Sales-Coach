/** Browser endpoint for the returning-visitor snippet. No secrets live here. */

export const VISITOR_FOLLOW_UP_SITE_ID = "sales-coach";

/** Used when a public endpoint is set but empty after the configuration check. */
export const VISITOR_FOLLOW_UP_DEFAULT_PUBLIC_ENDPOINT = "https://followup.refreshqueue.com";

export function normalizeVisitorFollowUpEndpoint(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  const path = url.pathname.replace(/\/+$/, "");
  return `${url.origin}${path === "/" ? "" : path}`;
}

/**
 * Script URL for the root layout. Renders nothing until
 * NEXT_PUBLIC_VISITOR_FOLLOW_UP_ENDPOINT is set (Next inlines it at build time).
 */
export function visitorFollowUpBrowserScriptSrc(
  env: Record<string, string | undefined> = process.env
): string | null {
  const configured = env.NEXT_PUBLIC_VISITOR_FOLLOW_UP_ENDPOINT?.trim() ?? "";
  if (!configured) return null;
  const endpoint = normalizeVisitorFollowUpEndpoint(configured || VISITOR_FOLLOW_UP_DEFAULT_PUBLIC_ENDPOINT);
  if (!endpoint) return null;
  return `${endpoint}/vf.js`;
}

export function visitorFollowUpScriptHosts(
  env: Record<string, string | undefined> = process.env
): string[] {
  const src = visitorFollowUpBrowserScriptSrc(env);
  if (!src) return [];
  try {
    return [new URL(src).origin];
  } catch {
    return [];
  }
}

export function visitorFollowUpConnectHosts(
  env: Record<string, string | undefined> = process.env
): string[] {
  return visitorFollowUpScriptHosts(env);
}

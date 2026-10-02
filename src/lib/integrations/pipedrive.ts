import { RevenueError } from "../revenue/security";
/** OAuth returns a company-specific API origin; never allow arbitrary credential destinations. */
export function pipedriveOrigin(value?: string) {
  let url: URL; try { url = new URL(value || ""); } catch { throw new RevenueError("Pipedrive did not return a valid account API address. Reconnect to try again.", 502); }
  if (url.protocol !== "https:" || !/^[a-z0-9][a-z0-9-]*\.pipedrive\.com$/i.test(url.hostname) || url.port || url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new RevenueError("Pipedrive returned an unsupported account API address.", 502);
  return url.origin;
}

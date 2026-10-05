import { OAUTH_APPS, supportedOAuthProvider } from "./oauth-config";
import { runtimeSecret } from "../revenue/runtime";
import { RevenueError } from "../revenue/security";
import { discordWebhook } from "./slack";

export function automaticRevocation(provider: string, secrets: Record<string, string>) {
  return (secrets.authType === "oauth" || secrets.authType === "oauth-webhook") &&
    ["google-calendar", "calendly", "hubspot", "asana", "linear", "github", "gitlab", "slack", "discord"].includes(provider) &&
    (provider !== "slack" || Boolean(secrets.oauthAccessToken));
}

/** Fixed vendor endpoints, no redirects, no vendor error text or credentials in logs. */
export async function revokeProviderGrant(provider: string, secrets: Record<string, string>) {
  const id = supportedOAuthProvider(provider);
  if (!id || !automaticRevocation(provider, secrets)) throw new RevenueError("Revoke access in the provider's connected-app settings.", 409);
  const app = OAUTH_APPS[id];
  const prefix = provider === "github" && secrets.githubApp !== "true" ? "GH_OAUTH" : app.prefix;
  const clientId = runtimeSecret(`${prefix}_CLIENT_ID`);
  const clientSecret = runtimeSecret(`${prefix}_CLIENT_SECRET`);
  const token = secrets.refreshToken || secrets.oauthAccessToken || secrets.token;
  const form = (data: Record<string, string>) => new URLSearchParams(data).toString();
  let url: string; let body: string | undefined; let method = "POST";
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
  const credentials = () => {
    if (!clientId || !clientSecret) throw new RevenueError("Provider app credentials are required to finish revocation.", 503);
    return { client_id: clientId, client_secret: clientSecret };
  };
  if (provider === "google-calendar") { url = "https://oauth2.googleapis.com/revoke"; body = form({ token }); }
  else if (provider === "github") {
    credentials(); url = `https://api.github.com/applications/${encodeURIComponent(clientId)}/grant`; method = "DELETE";
    headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
    headers["Content-Type"] = "application/json"; headers["User-Agent"] = "Sales-Coach";
    body = JSON.stringify({ access_token: secrets.token });
  } else if (provider === "slack") {
    url = "https://slack.com/api/apps.uninstall"; body = form({ ...credentials(), token: secrets.oauthAccessToken });
  } else if (provider === "discord") {
    // Deleting the channel webhook removes its independently usable capability too.
    const hook = discordWebhook(secrets.webhookUrl);
    const response = await fetch(hook, { method: "DELETE", redirect: "manual", signal: AbortSignal.timeout(15000), cache: "no-store" });
    if (!response.ok && response.status !== 404) throw new RevenueError("Channel webhook cleanup will retry.", 502);
    url = "https://discord.com/api/oauth2/token/revoke"; body = form({ ...credentials(), token: secrets.oauthAccessToken || secrets.token });
  } else if (provider === "hubspot") {
    url = "https://api.hubapi.com/oauth/2026-09/token/revoke"; body = form({ ...credentials(), token, token_type_hint: "refresh_token" });
  } else {
    url = provider === "asana" ? "https://app.asana.com/-/oauth_revoke" : provider === "linear" ? "https://api.linear.app/oauth/revoke" : `${app.tokenOrigin}/oauth/revoke`;
    body = form({ ...credentials(), token });
  }
  const response = await fetch(url, { method, headers, body, redirect: "manual", signal: AbortSignal.timeout(15000), cache: "no-store" });
  if (!response.ok) throw new RevenueError("Provider revocation failed and will retry. Access is disabled locally.", 502);
  if (provider === "slack") {
    const result = await response.json();
    if (!result.ok && result.error !== "not_installed") throw new RevenueError("Slack revocation will retry.", 502);
  }
}

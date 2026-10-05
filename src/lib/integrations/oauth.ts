import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, gt, lt, ne, sql } from "drizzle-orm";
import { db, ensureRevenueSchema } from "../db";
import { integrationOAuthStates, integrationOAuthRefreshLeases, integrationConnections } from "../db/schema";
import { currentTenantId } from "../tenant";
import { decryptCredentials, encryptCredentials, RevenueError, secureEqual, stableId } from "../revenue/security";
import { runtimeSecret } from "../revenue/runtime";
import { getConnection } from "../revenue/connections";
import { pipedriveOrigin } from "./pipedrive";
import { ProviderError, providerRequest } from "./http";
import { OAUTH_APPS, supportedOAuthProvider, type OAuthProvider } from "./oauth-config";

export const OAUTH_COOKIE = "sales_coach_integration_oauth";
const APPS = OAUTH_APPS;
export function oauthProvider(value: string): OAuthProvider {
  const provider = supportedOAuthProvider(value);
  if (!provider) throw new RevenueError("Unsupported sign-in provider.");
  return provider;
}
function credentialPrefixes(provider: OAuthProvider): string[] {
  // Gmail can reuse the Google Calendar OAuth client when GOOGLE_CLIENT_ID is not set.
  if (provider === "gmail") return ["GOOGLE", "GOOGLE_CALENDAR"];
  // Teams can reuse the Outlook mail app. That app is multitenant plus personal accounts, so tokens use /common.
  if (provider === "microsoft-teams") return ["MICROSOFT_TEAMS", "MICROSOFT"];
  return [APPS[provider].prefix];
}
function credentialChoices(provider: OAuthProvider) {
  const seen = new Set<string>();
  const choices: { clientId: string; clientSecret: string }[] = [];
  for (const prefix of credentialPrefixes(provider)) {
    const clientId = runtimeSecret(`${prefix}_CLIENT_ID`);
    const clientSecret = runtimeSecret(`${prefix}_CLIENT_SECRET`);
    if (!clientId || !clientSecret || seen.has(clientId)) continue;
    seen.add(clientId);
    choices.push({ clientId, clientSecret });
  }
  return choices;
}
function appCredentials(provider: OAuthProvider, clientId?: string) {
  const app = APPS[provider];
  const choices = credentialChoices(provider);
  // A code issued to the Gmail web client must not be exchanged with the calendar client.
  if (clientId) {
    const match = choices.find(choice => choice.clientId === clientId);
    if (!match) throw new RevenueError(`The ${app.label} sign-in client changed. Start sign-in again.`, 409);
    return { app, clientId: match.clientId, clientSecret: match.clientSecret };
  }
  const selected = choices[0];
  if (!selected) throw new RevenueError(`Ask your app administrator to configure ${app.label} sign-in credentials.`, 503);
  return { app, ...selected };
}
/** Google returns full scope URLs, extra scopes, and any order, separated by spaces. */
export function scopeGrantIncludes(granted: string, required: string): boolean {
  const tokens = granted.split(/[\s,]+/).map(scope => scope.trim().toLowerCase().replace(/\/+$/, "")).filter(Boolean);
  const needed = required.split(/[\s,]+/).map(scope => scope.trim().toLowerCase().replace(/\/+$/, "")).filter(Boolean);
  return needed.every(scope => {
    const tail = scope.split("/").pop() || scope;
    return tokens.some(token => token === scope || token === tail || token.endsWith(`/${tail}`));
  });
}
export function oauthAvailability() {
  return Object.fromEntries((Object.keys(APPS) as OAuthProvider[]).map(id => [id, credentialPrefixes(id).some(prefix => Boolean(runtimeSecret(`${prefix}_CLIENT_ID`) && runtimeSecret(`${prefix}_CLIENT_SECRET`)))]));
}
export function oauthRedirectUri(provider: OAuthProvider, requestOrigin: string) {
  const url = new URL(runtimeSecret("PUBLIC_APP_URL") || requestOrigin);
  if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && url.protocol === "http:")) throw new RevenueError("Sign-in needs an HTTPS app address.");
  return new URL(`/app/api/integrations/oauth/${provider}/callback`, url.origin).toString();
}

/** The one-use authorization state is bound to the initiating admin, workspace and browser. */
export async function startOAuth(provider: OAuthProvider, actor: string, body: any, origin: string) {
  const { app, clientId } = appCredentials(provider); await ensureRevenueSchema();
  const state = randomBytes(32).toString("base64url"); const id = stableId(state); const orgId = currentTenantId();
  const verifier = randomBytes(32).toString("base64url"); const redirectUri = oauthRedirectUri(provider, origin);
  await db.delete(integrationOAuthStates).where(lt(integrationOAuthStates.expiresAt, Date.now())).run();
  await db.insert(integrationOAuthStates).values({ id, orgId, actor, provider, expiresAt: Date.now() + 600000,
    credentials: encryptCredentials({ verifier, redirectUri, clientId, body: JSON.stringify({ name: body.name, autoSync: body.autoSync !== false }) }, `oauth:${orgId}:${id}`) }).run();
  const url = new URL(app.authorize);
  url.search = new URLSearchParams({ client_id: clientId, response_type: "code", redirect_uri: redirectUri, state, ...(app.scope ? { scope: app.scope } : {}),
    ...(app.pkce ? { code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256" } : {}),
    ...(provider === "google-calendar" || provider === "gmail" ? { access_type: "offline", prompt: "consent" } : {}),
    ...(provider === "notion" ? { owner: "user" } : {}) }).toString();
  return { url: url.toString(), state };
}
interface Tokens { api_domain?: string; access_token: string; refresh_token?: string; expires_in?: number; token_type?: string; scope?: string; ok?: boolean; error?: string; incoming_webhook?: { url?: string }; webhook?: { url?: string } }
async function exchange(provider: OAuthProvider, params: Record<string, string>, issuedClientId?: string): Promise<Tokens> {
  const { app, clientId, clientSecret } = appCredentials(provider, issuedClientId);
  const headers: Record<string, string> = { "Content-Type": app.encoding === "json" ? "application/json" : "application/x-www-form-urlencoded" };
  const basic = app.authentication.startsWith("basic");
  if (basic) headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString(app.authentication === "basic-url" ? "base64url" : "base64")}`;
  const body = { ...params, ...(basic ? {} : { client_id: clientId, client_secret: clientSecret }) };
  const result = await providerRequest<Tokens>(app.label, app.tokenOrigin, app.tokenPath, headers, { method: "POST",
    body: app.encoding === "json" ? JSON.stringify(body) : new URLSearchParams(body).toString() });
  const type = result.token_type?.trim().toLowerCase();
  if (result.ok === false || result.error || typeof result.access_token !== "string" || !result.access_token || (type && type !== "bearer" && !(provider === "slack" && type === "bot"))) throw new RevenueError("The provider returned an invalid authorization. Reconnect to try again.", 502);
  return result;
}
function tokenSecrets(provider: OAuthProvider, tokens: Tokens, previous: Record<string, string> = {}): Record<string, string> {
  // Channel webhooks remain valid independently of the OAuth access token.
  if (provider === "slack" || provider === "discord") {
    const webhookUrl = provider === "slack" ? tokens.incoming_webhook?.url : tokens.webhook?.url;
    if (!webhookUrl) throw new RevenueError("Choose a channel and approve incoming webhook access before connecting.");
    return { webhookUrl, authType: "oauth-webhook" };
  }
  let expiresAt = "";
  if (tokens.expires_in !== undefined) {
    const seconds = Number(tokens.expires_in);
    if (!Number.isFinite(seconds) || seconds <= 0) throw new RevenueError("The provider returned an invalid token expiration.", 502);
    expiresAt = String(Date.now() + seconds * 1000);
  } else if (provider === "monday") {
    try {
      const exp = Number(JSON.parse(Buffer.from(tokens.access_token.split(".")[1], "base64url").toString()).exp);
      if (!Number.isFinite(exp) || exp * 1000 <= Date.now()) throw new Error();
      expiresAt = String(exp * 1000);
    } catch { throw new RevenueError("monday.com returned an invalid token expiration.", 502); }
  } else if (tokens.refresh_token || APPS[provider].refreshRequired) expiresAt = String(Date.now() + 3600000);
  if ((APPS[provider].refreshRequired || expiresAt) && !tokens.refresh_token && !previous.refreshToken && !(provider === "todoist" && Number(tokens.expires_in) >= 315360000)) throw new RevenueError("The provider did not grant background access. Reconnect and allow the requested permissions.");
  return { ...previous, token: tokens.access_token, authType: "oauth", ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}), expiresAt, ...(provider === "pipedrive" ? { apiDomain: pipedriveOrigin(tokens.api_domain || previous.apiDomain) } : {}) };
}
export async function finishOAuth(provider: OAuthProvider, actor: string, state: string, browserState: string, code: string) {
  if (!state || !browserState || !secureEqual(state, browserState) || !code || code.length > 8192) throw new RevenueError("Sign-in expired or belongs to a different browser. Start again.");
  await ensureRevenueSchema(); const id = stableId(state); const orgId = currentTenantId();
  const rows = await db.delete(integrationOAuthStates).where(and(eq(integrationOAuthStates.id, id), eq(integrationOAuthStates.orgId, orgId), eq(integrationOAuthStates.actor, actor), eq(integrationOAuthStates.provider, provider), gt(integrationOAuthStates.expiresAt, Date.now()))).returning().all();
  if (!rows.length) throw new RevenueError("Sign-in expired or belongs to another workspace. Start again.");
  const saved = decryptCredentials(rows[0].credentials, `oauth:${orgId}:${id}`);
  const tokens = await exchange(provider, { grant_type: "authorization_code", code, redirect_uri: saved.redirectUri, ...(APPS[provider].pkce ? { code_verifier: saved.verifier } : {}) }, saved.clientId);
  if (provider === "gmail" && typeof tokens.scope === "string" && tokens.scope.trim() && !scopeGrantIncludes(tokens.scope, APPS.gmail.scope)) {
    throw new RevenueError("Google did not grant Gmail metadata access. Reconnect and allow View your email message metadata.");
  }
  if (provider === "microsoft-teams" && typeof tokens.scope === "string" && tokens.scope.trim()) {
    const required = APPS["microsoft-teams"].scope.split(/\s+/).filter(scope => scope && scope !== "offline_access").join(" ");
    if (!scopeGrantIncludes(tokens.scope, required)) throw new RevenueError("Microsoft did not grant Teams meeting, transcript, and recording access. Reconnect and approve the requested permissions.");
  }
  const secrets: Record<string, string> = { ...tokenSecrets(provider, tokens), redirectUri: saved.redirectUri, ...(saved.clientId ? { oauthClientId: saved.clientId } : {}) };
  return { body: JSON.parse(saved.body), secrets };
}

const refreshing = new Map<string, Promise<Record<string, string>>>();
export class OAuthReconnectError extends RevenueError {
  constructor() { super("Account authorization could not be refreshed. Disconnect and connect this integration again. If this repeats, ask your administrator to check the sign-in app credentials.", 409); }
}
export async function authorizedSecrets(connection: { id: string; provider: string; secrets: Record<string, string> }) {
  if (connection.secrets.authType !== "oauth" || !connection.secrets.expiresAt || Number(connection.secrets.expiresAt) > Date.now() + 120000) return connection.secrets;
  const key = `${currentTenantId()}:${connection.id}`; const pending = refreshing.get(key); if (pending) return pending;
  const refresh = (async () => {
    const orgId = currentTenantId(); const id = stableId("oauth-refresh", orgId, connection.id); const token = randomUUID();
    // Calendly refresh tokens are single-use. A database lease also coordinates separate Worker isolates.
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      const current = await getConnection(connection.id);
      if (!current.secrets.expiresAt || Number(current.secrets.expiresAt) > Date.now() + 120000) return current.secrets;
      const claimed = await db.insert(integrationOAuthRefreshLeases).values({ id, orgId, connectionId: connection.id, token, expiresAt: Date.now() + 120000 })
        .onConflictDoUpdate({ target: integrationOAuthRefreshLeases.id, set: { token, expiresAt: Date.now() + 120000 }, setWhere: lt(integrationOAuthRefreshLeases.expiresAt, Date.now()) }).returning().all();
      if (!claimed.length) { await new Promise(resolve => setTimeout(resolve, 250)); continue; }
      try {
        const latest = await getConnection(connection.id);
        if (!latest.secrets.expiresAt || Number(latest.secrets.expiresAt) > Date.now() + 120000) return latest.secrets;
        if (!latest.secrets.refreshToken) throw new OAuthReconnectError();
        let tokens: Tokens;
        try { tokens = await exchange(oauthProvider(latest.provider), { grant_type: "refresh_token", refresh_token: latest.secrets.refreshToken, ...(latest.provider === "gitlab" ? { redirect_uri: latest.secrets.redirectUri } : {}) }, latest.secrets.oauthClientId); }
        catch (error) {
          if (error instanceof ProviderError && [400, 401, 403].includes(error.providerStatus)) throw new OAuthReconnectError();
          if (error instanceof RevenueError && /sign-in client changed/.test(error.message)) throw new OAuthReconnectError();
          throw error;
        }
        if (latest.provider === "calendly" && !tokens.refresh_token) throw new OAuthReconnectError();
        const secrets = tokenSecrets(oauthProvider(latest.provider), tokens, latest.secrets);
        const saved = await db.update(integrationConnections).set({ credentials: encryptCredentials(secrets, key), updatedAt: new Date().toISOString() })
          .where(and(eq(integrationConnections.id, connection.id), eq(integrationConnections.orgId, orgId), ne(integrationConnections.status, "disconnected"),
            sql`exists (select 1 from ${integrationOAuthRefreshLeases} where ${integrationOAuthRefreshLeases.id} = ${id} and ${integrationOAuthRefreshLeases.token} = ${token} and ${integrationOAuthRefreshLeases.expiresAt} > ${Date.now()})`)).returning().all();
        if (!saved.length) throw new RevenueError("Authorization refresh was interrupted. Retry sync or reconnect the integration.", 409);
        return secrets;
      } finally {
        await db.delete(integrationOAuthRefreshLeases).where(and(eq(integrationOAuthRefreshLeases.id, id), eq(integrationOAuthRefreshLeases.token, token))).run();
      }
    }
    throw new RevenueError("Another worker is refreshing this integration. Sync will retry shortly.", 409);
  })();
  refreshing.set(key, refresh);
  try { return await refresh; } finally { refreshing.delete(key); }
}

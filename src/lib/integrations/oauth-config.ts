import apps from "./oauth-providers.json";

// Assumption: provider apps belong to the deployment; customers only approve account access.
export const OAUTH_APPS = apps;
export type OAuthProvider = keyof typeof apps;
export function supportedOAuthProvider(value: string): OAuthProvider | undefined {
  return Object.hasOwn(apps, value) ? value as OAuthProvider : undefined;
}
export function oauthButtonLabel(provider: OAuthProvider) {
  return `${provider === "slack" ? "Add to" : "Sign in with"} ${apps[provider].label}`;
}

export type IntegrationMode = "read" | "write";
export function oauthScope(provider: OAuthProvider, mode: IntegrationMode = "read") {
  const app = apps[provider] as { scope: string; writeScope?: string };
  if (provider === "gitlab" && mode === "write") throw new Error("GitLab writes require a project access token.");
  const separator = provider === "linear" ? "," : " ";
  return [app.scope, mode === "write" ? app.writeScope : ""].filter(Boolean).join(separator);
}

export function readOnlyGitlabScope(scope: string | undefined) {
  const scopes = (scope || "").trim().split(/[, ]+/).filter(Boolean);
  return scopes.length > 0 && scopes.every(value => value === "read_api");
}

export function restrictedGithubInstallation(installation: any, mode: IntegrationMode = "read"): boolean {
  const permissions = installation?.permissions;
  return installation?.repository_selection === "selected" && permissions?.metadata === "read" &&
    (mode === "write" ? permissions?.issues === "write" : ["read", "write"].includes(permissions?.issues)) &&
    Object.entries(permissions).every(([key, value]) => value === "none" || ["metadata", "issues"].includes(key));
}

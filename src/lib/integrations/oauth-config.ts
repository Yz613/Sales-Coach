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

import { RevenueError } from "../revenue/security";

export class ProviderError extends RevenueError {
  constructor(public provider: string, public providerStatus: number, public retryAfterSeconds = 0) {
    super(providerStatus === 401 || providerStatus === 403
      ? `${provider}: check the credential and required permissions.`
      : providerStatus === 429 ? `${provider}: rate limit reached. The job will retry.`
      : `${provider}: request failed (${providerStatus}).`, 502);
  }
}

/** Fixed vendor origins; redirects cannot forward credentials to another host. */
export async function providerRequest<T>(provider: string, origin: string, pathname: string, headers: Record<string, string>, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${origin}${pathname}`, {
    ...init, headers: { Accept: "application/json", ...headers, ...init.headers },
    redirect: "error", signal: AbortSignal.timeout(25000), cache: "no-store",
  });
  if (!response.ok) {
    const retry = response.headers.get("retry-after");
    const seconds = retry ? Number(retry) || Math.max(0, (Date.parse(retry) - Date.now()) / 1000) : 0;
    // Vendor error bodies can echo secrets and customer data. Keep errors to status and provider.
    throw new ProviderError(provider, response.status, Math.min(3600, Math.ceil(seconds)));
  }
  if (response.status === 204) return {} as T;
  return response.json() as Promise<T>;
}

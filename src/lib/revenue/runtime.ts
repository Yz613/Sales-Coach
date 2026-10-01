export interface RecordingBucket {
  put(key: string, bytes: Uint8Array, options?: { httpMetadata?: { contentType: string }; customMetadata?: Record<string, string> }): Promise<unknown>;
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer>; httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> } | null>;
  delete(key: string): Promise<void>;
}

export function revenueRuntime(): { env: Record<string, unknown>; cloudflare: boolean } {
  try {
    const context = require("@opennextjs/cloudflare").getCloudflareContext();
    if (context?.env?.DB) return { env: context.env, cloudflare: true };
  } catch { /* Node and test runtime. */ }
  return { env: process.env, cloudflare: false };
}

export function runtimeSecret(name: string): string {
  return String(revenueRuntime().env[name] || process.env[name] || "").trim();
}

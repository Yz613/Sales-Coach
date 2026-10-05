import type { IdentifyOptions, KvNamespaceLike, VisitorCache } from "visitor-company";

/** ESM-only package. Dynamic import keeps the CommonJS test runner and the Worker bundle on one entry. */
async function loadVisitorCompany() {
  return import("visitor-company");
}

/**
 * Isolate-local fallback used only when the VISITOR_COMPANY_KV binding is absent.
 * Entries are company decisions keyed by ASN or network prefix. They do not
 * include the visitor IP or any person identifier.
 */
let memoryCache: VisitorCache | undefined;

export type VisitorCompanyContext = {
  env?: Record<string, unknown>;
  cf?: unknown;
};

type WorkerVisitorContext = {
  env?: Record<string, unknown>;
  cf?: unknown;
};

function optionalSecret(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isKvNamespace(value: unknown): value is KvNamespaceLike {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { get?: unknown; put?: unknown };
  return typeof candidate.get === "function" && typeof candidate.put === "function";
}

function hasVisitorCf(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const cf = value as Record<string, unknown>;
  return (
    cf.asn != null ||
    typeof cf.asOrganization === "string" ||
    typeof cf.country === "string" ||
    typeof cf.isEUCountry === "boolean" ||
    cf.botManagement != null
  );
}

function cfOn(request: Request): unknown {
  return (request as Request & { cf?: unknown }).cf;
}

function requestWithCf(request: Request, cf: unknown): Request {
  try {
    Object.defineProperty(request, "cf", { value: cf, configurable: true });
    return request;
  } catch {
    const copy = new Request(request.url, request);
    Object.defineProperty(copy, "cf", { value: cf, configurable: true });
    return copy;
  }
}

/**
 * OpenNext's route `Request` often drops `request.cf`. The Worker still has
 * those fields on `getCloudflareContext().cf`. Prefer a `cf` object that
 * already carries visitor fields, then the Worker context.
 */
export function applyVisitorCf(request: Request, contextCf: unknown): Request {
  const current = cfOn(request);
  const chosen = hasVisitorCf(current) ? current : hasVisitorCf(contextCf) ? contextCf : current ?? contextCf;
  if (!chosen || chosen === current) return request;
  return requestWithCf(request, chosen);
}

function loadWorkerContext(): WorkerVisitorContext | null {
  try {
    const loaded = require("@opennextjs/cloudflare") as {
      getCloudflareContext?: () => { env?: Record<string, unknown>; cf?: unknown };
    };
    const ctx = loaded.getCloudflareContext?.();
    if (!ctx || typeof ctx !== "object") return null;
    return { env: ctx.env, cf: ctx.cf };
  } catch {
    return null;
  }
}

function sharedMemoryCache(createMemoryCache: () => VisitorCache): VisitorCache {
  memoryCache ??= createMemoryCache();
  return memoryCache;
}

function handlerOptions(
  env: Record<string, unknown>,
  api: {
    createKvCache: (kv: KvNamespaceLike) => VisitorCache;
    createMemoryCache: () => VisitorCache;
  },
): IdentifyOptions {
  const ipinfoToken = optionalSecret(env.IPINFO_TOKEN);
  const ipapiKey = optionalSecret(env.IPAPI_KEY);
  const kv = isKvNamespace(env.VISITOR_COMPANY_KV) ? env.VISITOR_COMPANY_KV : undefined;
  return {
    cache: kv ? api.createKvCache(kv) : sharedMemoryCache(api.createMemoryCache),
    ...(ipinfoToken ? { ipinfoToken } : {}),
    ...(ipapiKey ? { ipapiKey } : {}),
  };
}

function mergedEnv(context: VisitorCompanyContext | undefined, worker: WorkerVisitorContext | null): Record<string, unknown> {
  return {
    ...process.env,
    ...(context ? context.env ?? {} : worker?.env ?? {}),
  };
}

/** Resolve a company for this request. Tokens and KV are optional. */
export async function handleVisitorCompany(request: Request, context?: VisitorCompanyContext): Promise<Response> {
  const { createKvCache, createMemoryCache, createVisitorCompanyHandler } = await loadVisitorCompany();
  const worker = context ? null : loadWorkerContext();
  const env = mergedEnv(context, worker);
  const contextCf = context ? context.cf : worker?.cf;
  const ready = applyVisitorCf(request, contextCf);
  return createVisitorCompanyHandler(handlerOptions(env, { createKvCache, createMemoryCache }))(ready);
}

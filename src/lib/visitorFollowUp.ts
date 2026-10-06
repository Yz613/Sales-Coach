import { VISITOR_FOLLOW_UP_SITE_ID, normalizeVisitorFollowUpEndpoint } from "@/lib/visitorFollowUpPublic";

/** Short enough that a slow follow-up service cannot hold a form or checkout open. */
export const VISITOR_FOLLOW_UP_TIMEOUT_MS = 1500;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type VisitorFollowUpEnv = Record<string, string | undefined>;

export type VisitorIdentifyBody = {
  site_id: typeof VISITOR_FOLLOW_UP_SITE_ID;
  email: string;
  traits?: Record<string, string>;
  email_source: string;
};

export type VisitorConversionBody = {
  site_id: typeof VISITOR_FOLLOW_UP_SITE_ID;
  email: string;
  conversion_type: "stripe_subscription_paid" | "workspace_created";
  is_customer: boolean;
};

type FollowUpFetch = (input: string, init?: RequestInit) => Promise<Response>;
type WaitUntil = (promise: Promise<unknown>) => void;

const seenSignupEmails = new Set<string>();
const seenPaidEmails = new Set<string>();

export function resetVisitorFollowUpForTests(): void {
  seenSignupEmails.clear();
  seenPaidEmails.clear();
}

export function normalizeVisitorEmail(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email || email.length > 254 || !EMAIL.test(email)) return null;
  return email;
}

export function visitorFollowUpServerConfig(
  env: VisitorFollowUpEnv = process.env
): { endpoint: string; apiKey: string } | null {
  const endpoint = normalizeVisitorFollowUpEndpoint(env.VISITOR_FOLLOW_UP_ENDPOINT);
  const apiKey = env.VISITOR_FOLLOW_UP_API_KEY?.trim() || "";
  if (!endpoint || !apiKey) return null;
  return { endpoint, apiKey };
}

function readCloudflareWaitUntil(): WaitUntil | null {
  try {
    const loaded = require("@opennextjs/cloudflare") as {
      getCloudflareContext?: () => { ctx?: { waitUntil?: WaitUntil } };
    };
    const ctx = loaded.getCloudflareContext?.()?.ctx;
    if (!ctx || typeof ctx.waitUntil !== "function") return null;
    return (promise) => ctx.waitUntil!(promise);
  } catch {
    return null;
  }
}

/** Keep the Worker alive for the request, and never surface a failure to the caller. */
export function scheduleVisitorFollowUp(
  task: Promise<void>,
  readWaitUntil: () => WaitUntil | null = readCloudflareWaitUntil
): void {
  const safe = task.catch((err: unknown) => {
    console.error("visitor follow-up request failed", err instanceof Error ? err.name : "Error");
  });
  let waitUntil: WaitUntil | null = null;
  try {
    waitUntil = readWaitUntil();
  } catch {
    waitUntil = null;
  }
  if (waitUntil) {
    try {
      waitUntil(safe);
      return;
    } catch (err: unknown) {
      console.error("visitor follow-up waitUntil failed", err instanceof Error ? err.name : "Error");
    }
  }
  void safe;
}

export async function postVisitorFollowUp(
  path: "/v1/identify" | "/v1/conversions",
  body: VisitorIdentifyBody | VisitorConversionBody,
  env: VisitorFollowUpEnv = process.env,
  fetchImpl: FollowUpFetch = fetch,
  timeoutMs = VISITOR_FOLLOW_UP_TIMEOUT_MS
): Promise<"skipped" | "sent" | "failed"> {
  const config = visitorFollowUpServerConfig(env);
  const email = normalizeVisitorEmail(body.email);
  if (!config || !email) return "skipped";
  try {
    const response = await fetchImpl(`${config.endpoint}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...body, email }),
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.status < 200 || response.status >= 300) {
      console.error(`visitor follow-up ${path} failed`, response.status);
      return "failed";
    }
    return "sent";
  } catch (err: unknown) {
    console.error(`visitor follow-up ${path} failed`, err instanceof Error ? err.name : "Error");
    return "failed";
  }
}

export function integrationRequestIdentifyBody(input: {
  name: string;
  email: string;
  integration: string;
  useCase: string;
}): VisitorIdentifyBody {
  return {
    site_id: VISITOR_FOLLOW_UP_SITE_ID,
    email: input.email.trim().toLowerCase(),
    traits: {
      name: input.name,
      integration: input.integration,
      useCase: input.useCase,
    },
    email_source: "form:integration-request",
  };
}

export function notifyIntegrationRequest(
  input: { name: string; email: string; integration: string; useCase: string },
  env: VisitorFollowUpEnv = process.env
): void {
  const task = postVisitorFollowUp("/v1/identify", integrationRequestIdentifyBody(input), env).then(() => undefined);
  scheduleVisitorFollowUp(task);
}

export function paidSubscriptionConversionBody(email: string): VisitorConversionBody {
  return {
    site_id: VISITOR_FOLLOW_UP_SITE_ID,
    email: email.trim().toLowerCase(),
    conversion_type: "stripe_subscription_paid",
    is_customer: true,
  };
}

export function notifyPaidSubscription(email: string | null | undefined, env: VisitorFollowUpEnv = process.env): void {
  const normalized = normalizeVisitorEmail(email);
  if (!normalized || !visitorFollowUpServerConfig(env) || seenPaidEmails.has(normalized)) return;
  seenPaidEmails.add(normalized);
  const task = postVisitorFollowUp("/v1/conversions", paidSubscriptionConversionBody(normalized), env).then(() => undefined);
  scheduleVisitorFollowUp(task);
}

/**
 * Workspace creation is a conversion, not a paid subscription.
 * /v1/conversions defaults is_customer to true, which would suppress follow-up.
 * Paying customers are suppressed only by the Stripe event.
 */
export function workspaceCreatedConversionBody(email: string): VisitorConversionBody {
  return {
    site_id: VISITOR_FOLLOW_UP_SITE_ID,
    email: email.trim().toLowerCase(),
    conversion_type: "workspace_created",
    is_customer: false,
  };
}

export function notifyWorkspaceCreated(email: string | null | undefined, env: VisitorFollowUpEnv = process.env): void {
  const normalized = normalizeVisitorEmail(email);
  if (!normalized) return;
  const task = postVisitorFollowUp("/v1/conversions", workspaceCreatedConversionBody(normalized), env).then(() => undefined);
  scheduleVisitorFollowUp(task);
}

export function identifySignupVisitor(
  input: { email?: string | null; name?: string | null },
  env: VisitorFollowUpEnv = process.env
): void {
  const email = normalizeVisitorEmail(input.email);
  if (!email || !visitorFollowUpServerConfig(env) || seenSignupEmails.has(email)) return;
  seenSignupEmails.add(email);
  const name = input.name?.trim() || "";
  const body: VisitorIdentifyBody = {
    site_id: VISITOR_FOLLOW_UP_SITE_ID,
    email,
    email_source: "signup",
  };
  if (name) body.traits = { name };
  const task = postVisitorFollowUp("/v1/identify", body, env).then(() => undefined);
  scheduleVisitorFollowUp(task);
}

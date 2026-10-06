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

/** Clerk organization or instance invitation that can prove a teammate join. */
export type InviteLeadRecord = {
  email?: string | null;
  status?: string | null;
};

/** Signals that a Clerk organization membership was created from an invitation. */
export type MembershipLeadSignal = {
  createdViaInvitation?: boolean | null;
  invitationId?: string | null;
  source?: string | null;
};

const INVITE_LEAD_STATUSES = new Set(["pending", "accepted"]);
const INVITE_MEMBERSHIP_SOURCES = new Set(["invitation", "organization_invitation", "invite"]);

/** Pending and accepted invites match. Revoked and expired invites do not. A missing status still matches. */
export function emailMatchesInviteRecord(
  email: string | null | undefined,
  invites: InviteLeadRecord[] | null | undefined
): boolean {
  const normalized = normalizeVisitorEmail(email);
  if (!normalized || !invites?.length) return false;
  return invites.some((invite) => {
    if (normalizeVisitorEmail(invite.email) !== normalized) return false;
    const status = invite.status?.trim().toLowerCase();
    if (!status) return true;
    return INVITE_LEAD_STATUSES.has(status);
  });
}

export function membershipCameFromInvitation(membership: MembershipLeadSignal | null | undefined): boolean {
  if (!membership) return false;
  if (membership.createdViaInvitation === true) return true;
  if (typeof membership.invitationId === "string" && membership.invitationId.trim().length > 0) return true;
  const source = membership.source?.trim().toLowerCase();
  return Boolean(source && INVITE_MEMBERSHIP_SOURCES.has(source));
}

export function teammateInviteBlocksLead(
  email: string | null | undefined,
  invites: InviteLeadRecord[] | null | undefined,
  memberships: MembershipLeadSignal[] | null | undefined
): boolean {
  if (emailMatchesInviteRecord(email, invites)) return true;
  return Boolean(memberships?.some((membership) => membershipCameFromInvitation(membership)));
}

/** True only when a signup identify would call the service. Keeps Clerk lookups off the no-op path. */
export function signupIdentifyPending(email: string | null | undefined, env: VisitorFollowUpEnv = process.env): boolean {
  const normalized = normalizeVisitorEmail(email);
  if (!normalized || !visitorFollowUpServerConfig(env) || seenSignupEmails.has(normalized)) return false;
  return true;
}

function firstNonEmptyString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export function membershipLeadSignalFromRaw(raw: object | null | undefined): MembershipLeadSignal {
  if (!raw) return {};
  const record = raw as Record<string, unknown>;
  const nested = record.organization_invitation;
  const nestedId =
    nested && typeof nested === "object" ? (nested as { id?: unknown }).id : undefined;
  return {
    createdViaInvitation: record.created_via_invitation === true || record.from_invitation === true,
    invitationId: firstNonEmptyString(record.invitation_id, record.organization_invitation_id, nestedId),
    source: firstNonEmptyString(record.source, record.created_from),
  };
}

/**
 * Clerk stores teammate invites. There is no local invites table.
 * A lookup failure must reject the caller so sign-in does not identify the address.
 */
export async function loadTeammateInviteLeadSignals(input: {
  userId: string;
  orgId?: string | null;
  email: string;
}): Promise<{ invites: InviteLeadRecord[]; memberships: MembershipLeadSignal[] }> {
  const { clerkClient } = await import("@clerk/nextjs/server");
  const client = await clerkClient();
  const invites: InviteLeadRecord[] = [];
  const memberships: MembershipLeadSignal[] = [];
  const [accepted, pending, membershipPage] = await Promise.all([
    client.users.getOrganizationInvitationList({ userId: input.userId, status: "accepted", limit: 100 }),
    client.users.getOrganizationInvitationList({ userId: input.userId, status: "pending", limit: 100 }),
    client.users.getOrganizationMembershipList({ userId: input.userId, limit: 100 }),
  ]);
  for (const invitation of [...accepted.data, ...pending.data]) {
    invites.push({ email: invitation.emailAddress, status: invitation.status ?? null });
  }
  for (const membership of membershipPage.data) {
    memberships.push(membershipLeadSignalFromRaw(membership.raw));
  }
  if (input.orgId) {
    const orgInvites = await client.organizations.getOrganizationInvitationList({
      organizationId: input.orgId,
      status: ["accepted", "pending"],
      limit: 100,
    });
    for (const invitation of orgInvites.data) {
      invites.push({ email: invitation.emailAddress, status: invitation.status ?? null });
    }
  }
  try {
    const instanceInvites = await client.invitations.getInvitationList({
      query: input.email,
      status: "accepted",
      limit: 100,
    });
    for (const invitation of instanceInvites.data) {
      invites.push({ email: invitation.emailAddress, status: invitation.status });
    }
  } catch {
    // Organization invitations already cover teammate invites. Instance invitations are extra.
  }
  return { invites, memberships };
}

export function identifySignupVisitor(
  input: {
    email?: string | null;
    name?: string | null;
    invites?: InviteLeadRecord[] | null;
    memberships?: MembershipLeadSignal[] | null;
  },
  env: VisitorFollowUpEnv = process.env
): void {
  const email = normalizeVisitorEmail(input.email);
  if (!email || !visitorFollowUpServerConfig(env) || seenSignupEmails.has(email)) return;
  seenSignupEmails.add(email);
  if (teammateInviteBlocksLead(email, input.invites, input.memberships)) return;
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

import type { AuthUser } from "@/lib/auth";
import {
  HOSTED_PLANS,
  assessEvalQuota,
  parseHostedPlanId,
  utcMonthKey,
  type HostedPlanId,
  type QuotaDecision,
} from "@/lib/billing";
import { getSetting, setSetting } from "@/lib/db/service";

export class QuotaExceededError extends Error {
  status = 402;
  code: "QUOTA_EXCEEDED" | "FAIR_USE_EXCEEDED";

  constructor(message: string, code: "QUOTA_EXCEEDED" | "FAIR_USE_EXCEEDED") {
    super(message);
    this.name = "QuotaExceededError";
    this.code = code;
  }
}

export type BillingUsage = {
  month: string;
  creditsUsed: number;
  overageCredits: number;
  overageAmountUsd: number;
};

export type BillingAccount = {
  scope: string;
  planId: HostedPlanId;
  monthlyLimit: number | null;
  overageOptIn: boolean;
  unlimited: boolean;
  usage: BillingUsage;
};

function planKey(scope: string) {
  return `billing:${scope}:plan`;
}

function overageKey(scope: string) {
  return `billing:${scope}:overage_opt_in`;
}

function limitOverrideKey(scope: string) {
  return `billing:${scope}:eval_limit`;
}

function usageKey(scope: string, month: string) {
  return `billing:${scope}:usage:${month}`;
}

export function billingScope(auth: Pick<AuthUser, "isClerkConfigured" | "orgId">): string {
  if (!auth.isClerkConfigured) return "local";
  return (auth.orgId || "workspace").trim() || "workspace";
}

function parseUsage(raw: string | null, month: string): BillingUsage {
  if (!raw) {
    return { month, creditsUsed: 0, overageCredits: 0, overageAmountUsd: 0 };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<BillingUsage>;
    return {
      month: parsed.month || month,
      creditsUsed: Math.max(0, Number(parsed.creditsUsed) || 0),
      overageCredits: Math.max(0, Number(parsed.overageCredits) || 0),
      overageAmountUsd: Math.max(0, Number(parsed.overageAmountUsd) || 0),
    };
  } catch {
    return { month, creditsUsed: 0, overageCredits: 0, overageAmountUsd: 0 };
  }
}

export async function loadBillingAccount(
  auth: Pick<AuthUser, "isClerkConfigured" | "orgId">
): Promise<BillingAccount> {
  const scope = billingScope(auth);
  const unlimited = !auth.isClerkConfigured;
  const storedPlan = parseHostedPlanId(await getSetting(planKey(scope)));
  const planId: HostedPlanId = unlimited ? "oss" : storedPlan || "coach";
  const plan = HOSTED_PLANS[planId];
  const override = Number.parseInt((await getSetting(limitOverrideKey(scope))) || "", 10);
  const monthlyLimit =
    unlimited || plan.monthlyEvals == null
      ? null
      : Number.isFinite(override) && override > 0
        ? override
        : plan.monthlyEvals;

  const storedOverage = await getSetting(overageKey(scope));
  const overageOptIn =
    storedOverage == null ? plan.defaultOverageOptIn : storedOverage === "true";

  const month = utcMonthKey();
  const usage = parseUsage(await getSetting(usageKey(scope, month)), month);

  return {
    scope,
    planId,
    monthlyLimit,
    overageOptIn: plan.allowsOverage ? overageOptIn : false,
    unlimited,
    usage,
  };
}

export async function saveBillingSettings(
  auth: Pick<AuthUser, "isClerkConfigured" | "orgId">,
  input: { planId?: HostedPlanId; overageOptIn?: boolean }
): Promise<BillingAccount> {
  const scope = billingScope(auth);
  if (input.planId) {
    await setSetting(planKey(scope), input.planId);
  }
  if (input.overageOptIn !== undefined) {
    await setSetting(overageKey(scope), input.overageOptIn ? "true" : "false");
  }
  return loadBillingAccount(auth);
}

export function summarizeBilling(account: BillingAccount) {
  const plan = HOSTED_PLANS[account.planId];
  const remaining =
    account.monthlyLimit == null
      ? null
      : Math.max(0, account.monthlyLimit - account.usage.creditsUsed);
  return {
    planId: account.planId,
    planName: plan.name,
    monthlyLimit: account.monthlyLimit,
    overageOptIn: account.overageOptIn,
    allowsOverage: plan.allowsOverage,
    unlimited: account.unlimited,
    usage: account.usage,
    remaining,
  };
}

export async function assertEvaluationAllowed(
  auth: Pick<AuthUser, "isClerkConfigured" | "orgId">,
  requestedCredits: number
): Promise<{ account: BillingAccount; decision: Extract<QuotaDecision, { ok: true }> }> {
  const account = await loadBillingAccount(auth);
  const decision = assessEvalQuota({
    planId: account.planId,
    monthlyLimit: account.monthlyLimit,
    creditsUsed: account.usage.creditsUsed,
    requestedCredits,
    overageOptIn: account.overageOptIn,
  });
  if (!decision.ok) {
    throw new QuotaExceededError(decision.error, decision.code);
  }
  return { account, decision };
}

export async function recordEvaluationUsage(
  auth: Pick<AuthUser, "isClerkConfigured" | "orgId">,
  requestedCredits: number
): Promise<BillingUsage> {
  const { account, decision } = await assertEvaluationAllowed(auth, requestedCredits);
  const month = utcMonthKey();
  const next: BillingUsage = {
    month,
    creditsUsed: decision.creditsAfter,
    overageCredits: account.usage.overageCredits + decision.overageCredits,
    overageAmountUsd: Number(
      (account.usage.overageAmountUsd + decision.overageAmountUsd).toFixed(2)
    ),
  };
  await setSetting(usageKey(account.scope, month), JSON.stringify(next));
  return next;
}

export function quotaHttpStatus(err: unknown): number {
  return err instanceof QuotaExceededError ? err.status : 500;
}

import {
  HOSTED_PLANS,
  assessEvalQuota,
  parseHostedPlanId,
  utcMonthKey,
  type HostedPlanId,
  type QuotaDecision,
} from "@/lib/billing";
import {
  hostedBillingRequired,
  isPaidHostedPlan,
  planFromClerkHas,
  type ClerkHas,
} from "@/lib/billingAccess";
import { getSetting, setSetting } from "@/lib/db/service";
import { LOCAL_TENANT_ID, resolveTenantId } from "@/lib/tenant";

export class QuotaExceededError extends Error {
  status = 402;
  code: "QUOTA_EXCEEDED" | "FAIR_USE_EXCEEDED";

  constructor(message: string, code: "QUOTA_EXCEEDED" | "FAIR_USE_EXCEEDED") {
    super(message);
    this.name = "QuotaExceededError";
    this.code = code;
  }
}

export class PaymentRequiredError extends Error {
  status = 402;
  code = "PAYMENT_REQUIRED" as const;

  constructor(message = "Subscribe to a hosted plan to use this workspace.") {
    super(message);
    this.name = "PaymentRequiredError";
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
  paid: boolean;
  monthlyLimit: number | null;
  overageOptIn: boolean;
  unlimited: boolean;
  usage: BillingUsage;
};

type BillingAuth = {
  isClerkConfigured: boolean;
  orgId?: string | null;
  clerkPlanId?: HostedPlanId | null;
};

function planKey() {
  return "billing:plan";
}

function overageKey() {
  return "billing:overage_opt_in";
}

function limitOverrideKey() {
  return "billing:eval_limit";
}

function usageKey(month: string) {
  return `billing:usage:${month}`;
}

export function billingScope(auth: BillingAuth): string {
  if (!auth.isClerkConfigured) return LOCAL_TENANT_ID;
  return resolveTenantId(auth);
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
  auth: BillingAuth,
  has?: ClerkHas
): Promise<BillingAccount> {
  const unlimited = !auth.isClerkConfigured || !hostedBillingRequired();
  const clerkPlan = auth.clerkPlanId || planFromClerkHas(has);
  const month = utcMonthKey();
  const [storedPlanRaw, overrideRaw, storedOverage, usageRaw] = await Promise.all([
    getSetting(planKey()),
    getSetting(limitOverrideKey()),
    getSetting(overageKey()),
    getSetting(usageKey(month)),
  ]);
  const storedPlan = parseHostedPlanId(storedPlanRaw);
  const entitled = clerkPlan || (isPaidHostedPlan(storedPlan) ? storedPlan : null);

  if (clerkPlan && clerkPlan !== storedPlan) {
    await setSetting(planKey(), clerkPlan);
  }

  let planId: HostedPlanId;
  let paid: boolean;
  if (unlimited) {
    planId = storedPlan || "oss";
    paid = true;
  } else if (entitled) {
    planId = entitled;
    paid = true;
  } else {
    planId = "coach";
    paid = false;
  }

  const plan = HOSTED_PLANS[planId];
  const override = Number.parseInt(overrideRaw || "", 10);
  const monthlyLimit = unlimited
    ? null
    : !paid
      ? 0
      : plan.monthlyEvals == null
        ? null
        : Number.isFinite(override) && override > 0
          ? override
          : plan.monthlyEvals;

  const overageOptIn =
    storedOverage == null ? plan.defaultOverageOptIn : storedOverage === "true";

  const usage = parseUsage(usageRaw, month);

  return {
    scope: unlimited ? LOCAL_TENANT_ID : billingScope(auth),
    planId,
    paid,
    monthlyLimit,
    overageOptIn: plan.allowsOverage ? overageOptIn : false,
    unlimited,
    usage,
  };
}

export async function saveBillingSettings(
  auth: BillingAuth,
  input: { overageOptIn?: boolean }
): Promise<BillingAccount> {
  if (input.overageOptIn !== undefined) {
    await setSetting(overageKey(), input.overageOptIn ? "true" : "false");
  }
  return loadBillingAccount(auth);
}

export async function activateHostedPlan(planId: HostedPlanId): Promise<void> {
  if (!isPaidHostedPlan(planId)) {
    throw new Error(`Cannot activate unpaid plan ${planId}`);
  }
  await setSetting(planKey(), planId);
}

export async function revokeHostedPlan(): Promise<void> {
  await setSetting(planKey(), "oss");
}

export function summarizeBilling(account: BillingAccount) {
  const plan = HOSTED_PLANS[account.planId];
  const remaining =
    account.monthlyLimit == null
      ? null
      : Math.max(0, account.monthlyLimit - account.usage.creditsUsed);
  return {
    planId: account.planId,
    planName: account.paid ? plan.name : "Unpaid",
    paid: account.paid,
    monthlyLimit: account.monthlyLimit,
    overageOptIn: account.overageOptIn,
    allowsOverage: plan.allowsOverage,
    unlimited: account.unlimited,
    usage: account.usage,
    remaining,
  };
}

export async function assertEvaluationAllowed(
  auth: BillingAuth,
  requestedCredits: number
): Promise<{ account: BillingAccount; decision: Extract<QuotaDecision, { ok: true }> }> {
  const account = await loadBillingAccount(auth);
  if (hostedBillingRequired() && auth.isClerkConfigured && !account.paid) {
    throw new PaymentRequiredError();
  }
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
  auth: BillingAuth,
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
  await setSetting(usageKey(month), JSON.stringify(next));
  return next;
}

export function quotaHttpStatus(err: unknown): number {
  if (err instanceof PaymentRequiredError || err instanceof QuotaExceededError) return err.status;
  return 500;
}

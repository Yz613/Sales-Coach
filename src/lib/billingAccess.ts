import type { HostedPlanId } from "@/lib/billing";
import { parseHostedPlanId } from "@/lib/billing";

export const CLERK_ORG_PLAN_SLUGS: Record<Exclude<HostedPlanId, "oss">, string[]> = {
  coach: ["coach", "hosted_coach", "starter", "org:coach", "org:starter", "org:hosted_coach"],
  team: ["team", "hosted_team", "pro", "org:team", "org:pro", "org:hosted_team"],
  enterprise: ["enterprise", "org:enterprise"],
};

export type ClerkHas = ((resource: { plan: string } | { feature: string }) => boolean) | undefined;

/** Hosted Clerk deployments must charge unless an operator explicitly opts out. */
export function hostedBillingRequired(env: Record<string, string | undefined> = process.env): boolean {
  const raw = (env.BILLING_REQUIRED || "").trim().toLowerCase();
  if (["0", "false", "off", "no"].includes(raw)) return false;
  if (["1", "true", "on", "yes"].includes(raw)) return true;
  return Boolean(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() && env.CLERK_SECRET_KEY?.trim());
}

export function planFromClerkHas(has: ClerkHas): HostedPlanId | null {
  if (typeof has !== "function") return null;
  for (const [planId, slugs] of Object.entries(CLERK_ORG_PLAN_SLUGS) as [
    Exclude<HostedPlanId, "oss">,
    string[],
  ][]) {
    for (const slug of slugs) {
      try {
        if (has({ plan: slug })) return planId;
      } catch {
        // Clerk throws when billing is disabled or the slug is unknown.
      }
    }
  }
  return null;
}

export function planFromMetadata(meta: unknown): HostedPlanId | null {
  if (!meta || typeof meta !== "object") return null;
  const record = meta as Record<string, unknown>;
  return parseHostedPlanId(
    typeof record.plan === "string"
      ? record.plan
      : typeof record.hostedPlan === "string"
        ? record.hostedPlan
        : null
  );
}

export function isPaidHostedPlan(planId: HostedPlanId | null | undefined): boolean {
  return planId === "coach" || planId === "team" || planId === "enterprise";
}

import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { getServerAuth, type AuthUser } from "@/lib/auth";
import { hostedBillingRequired } from "@/lib/billingAccess";
import { PaymentRequiredError } from "@/lib/billingQuota";
import { TenantRequiredError } from "@/lib/tenant";
import { toAppPath } from "@/lib/public-path";

export class WorkspaceUnauthorizedError extends Error {
  status = 401;
  code = "UNAUTHORIZED";

  constructor(message = "Sign in to continue.") {
    super(message);
    this.name = "WorkspaceUnauthorizedError";
  }
}

export async function requireWorkspace(): Promise<AuthUser> {
  const auth = await getServerAuth();
  if (auth.isClerkConfigured && !auth.userId) {
    throw new WorkspaceUnauthorizedError();
  }
  if (auth.isClerkConfigured && !auth.orgId) {
    throw new TenantRequiredError();
  }
  if (hostedBillingRequired() && auth.isClerkConfigured && !auth.billingPaid) {
    throw new PaymentRequiredError();
  }
  return auth;
}

export function workspaceErrorResponse(err: unknown): NextResponse {
  if (err instanceof PaymentRequiredError) {
    return NextResponse.json(
      { error: err.message, code: err.code, checkout: toAppPath("/subscribe") },
      { status: 402 }
    );
  }
  if (err instanceof TenantRequiredError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: 401 });
  }
  if (err instanceof WorkspaceUnauthorizedError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: 401 });
  }
  const status = typeof (err as { status?: number })?.status === "number" ? (err as { status: number }).status : 500;
  const message = err instanceof Error ? err.message : "Request failed";
  return NextResponse.json({ error: message }, { status: status >= 400 && status < 600 ? status : 500 });
}

/** Server-page gate: send unpaid / org-less Clerk users to the right screen. */
export async function requireWorkspacePage(): Promise<AuthUser> {
  const auth = await getServerAuth();
  if (auth.isClerkConfigured && !auth.userId) {
    redirect(toAppPath("/sign-in"));
  }
  if (auth.isClerkConfigured && !auth.orgId) {
    redirect(toAppPath("/select-organization"));
  }
  if (hostedBillingRequired() && auth.isClerkConfigured && !auth.billingPaid) {
    redirect(toAppPath("/subscribe"));
  }
  return auth;
}

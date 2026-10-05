import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { authRedirectPath, getServerAuth, runWithAuth, type AuthUser } from "@/lib/auth";
import { hostedBillingRequired } from "@/lib/billingAccess";
import { PaymentRequiredError } from "@/lib/billingQuota";
import { TenantRequiredError, runWithTenant, resolveTenantId } from "@/lib/tenant";
import { toAppPath, stripAppBasePath } from "@/lib/public-path";
import { hasClerkServerAuth } from "@/lib/clerk-env";
import { assertSecureDeployment, assertMutationOrigin, assertLocalRequest, boundedRequest, privateResponse, localDevelopmentAllowed, mfaRequired, SecurityPolicyError } from "@/lib/security-policy";
import { consumeLimit, consumeRequestLimit, assertFailureBudget, publicWebhookBudget } from "@/lib/security-rate-limit";
import { audit } from "@/lib/revenue/connections";

export class WorkspaceUnauthorizedError extends Error {
  status = 401;
  code = "UNAUTHORIZED";

  constructor(message = "Sign in to continue.") {
    super(message);
    this.name = "WorkspaceUnauthorizedError";
  }
}

export async function requireWorkspace(): Promise<AuthUser> {
  assertSecureDeployment();
  const auth = await getServerAuth();
  if (!localDevelopmentAllowed() && !hasClerkServerAuth()) {
    throw new WorkspaceUnauthorizedError();
  }
  if (auth.isClerkConfigured && !auth.userId) {
    throw new WorkspaceUnauthorizedError();
  }
  if (auth.isClerkConfigured && !auth.orgId) {
    throw new TenantRequiredError();
  }
  if (auth.userId && mfaRequired() && !auth.mfaVerified) {
    throw new SecurityPolicyError("Verify a second factor to continue. Open account security, then sign in again.", 403, "MFA_REQUIRED");
  }
  if (hostedBillingRequired() && auth.isClerkConfigured && !auth.billingPaid) {
    throw new PaymentRequiredError();
  }
  return auth;
}

export async function requireWorkspaceAdmin(): Promise<AuthUser> {
  const auth = await requireWorkspace();
  if (!auth.isAdmin) throw new SecurityPolicyError("Administrator permissions are required.");
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
  const safeStatus = status >= 400 && status < 600 ? status : 500;
  const message = safeStatus < 500 && err instanceof Error ? err.message : "Request failed. Please try again or contact your administrator.";
  const response = NextResponse.json({ error: message, ...(err instanceof SecurityPolicyError ? { code: err.code } : {}) }, { status: safeStatus });
  if (safeStatus === 429) response.headers.set("Retry-After", "60");
  return response;
}

/** Server-page gate: send unpaid / org-less Clerk users to the right screen. */
export async function requireWorkspacePage(): Promise<AuthUser> {
  assertSecureDeployment();
  const auth = await getServerAuth();
  const dest = authRedirectPath(auth);
  if (dest) {
    redirect(stripAppBasePath(dest));
  }
  return auth;
}

type RouteHandler = (...args: any[]) => Promise<Response>;

/** All workspace entry points scope the entire operation, including asynchronous DB and media access. */
export function withWorkspaceApi<H extends RouteHandler>(handler: H, options: { admin?: boolean } = {}): H {
  return (async (request: Request, ...args: any[]) => {
    try {
      assertSecureDeployment();
      assertLocalRequest(request);
      assertMutationOrigin(request);
      const auth = options.admin ? await requireWorkspaceAdmin() : await requireWorkspace();
      return await runWithAuth(auth, () => runWithTenant(resolveTenantId(auth), async () => {
        await consumeRequestLimit(request, auth);
        const upload = new URL(request.url).pathname.endsWith("/upload") || new URL(request.url).pathname.endsWith("/batch-upload");
        const bounded = ["GET", "HEAD"].includes(request.method) ? request : await boundedRequest(request, upload ? 32 * 1024 * 1024 : 1024 * 1024);
        const response = await handler(bounded, ...args);
        if (!["GET", "HEAD", "OPTIONS"].includes(request.method) && response.ok) {
          await audit(auth.userId || "local", `api.${request.method.toLowerCase()}`, new URL(request.url).pathname.slice(0, 300));
        }
        return privateResponse(response.status >= 500 ? workspaceErrorResponse({ status: response.status }) : response);
      }));
    } catch (error) {
      const response = privateResponse(workspaceErrorResponse(error));
      const requestId = crypto.randomUUID();
      response.headers.set("X-Request-ID", requestId);
      console.warn(JSON.stringify({ event: "security.request_denied", requestId, status: response.status, method: request.method, path: new URL(request.url).pathname.slice(0, 300) }));
      return response;
    }
  }) as H;
}

export function withWorkspacePage<A extends any[], T>(page: (...args: A) => Promise<T>, options: { admin?: boolean } = {}) {
  return async (...args: A): Promise<T> => {
    const auth = await requireWorkspacePage();
    if (options.admin && !auth.isAdmin) redirect("/calls");
    return runWithAuth(auth, () => runWithTenant(resolveTenantId(auth), () => page(...args)));
  };
}

/** Public handlers still have bounded input and private responses; webhooks use their signature instead of browser Origin. */
export function withPublicApi<H extends RouteHandler>(handler: H, options: { webhook?: boolean; limit?: number } = {}): H {
  return (async (request: Request, ...args: any[]) => {
    try {
      if (!options.webhook) assertMutationOrigin(request);
      if (/\/(?:api\/billing\/checkout|checkout\/success)$/.test(new URL(request.url).pathname)) {
        assertSecureDeployment();
        await consumeLimit("public:checkout", 30);
      }
      const budget = options.webhook ? publicWebhookBudget(request) : undefined;
      if (budget) {
        await consumeLimit(budget.identity, budget.requests);
        await consumeLimit(`${budget.connection}:requests`, 120);
        await assertFailureBudget(`${budget.connection}:failures`);
      }
      const bounded = ["GET", "HEAD"].includes(request.method) ? request : await boundedRequest(request, Math.min(options.limit || 2 * 1024 * 1024, budget?.bodyLimit || Infinity));
      const response = await handler(bounded, ...args);
      if (budget && response.status >= 400 && response.status !== 429) await consumeLimit(`${budget.connection}:failures`, 20);
      return privateResponse(response.status >= 500 ? workspaceErrorResponse({ status: response.status }) : response);
    } catch (error) { return privateResponse(workspaceErrorResponse(error)); }
  }) as H;
}

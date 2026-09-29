import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { hasClerkServerAuth } from "@/lib/clerk-env";
import { resolveUserRole } from "@/lib/roles";
import { pendingTeamSelectionPath } from "@/lib/session-task";
import {
  getPublicPath,
  toAppPath,
  isPublicAuthRoute,
  isPublicApiRoute,
  isApiRoute,
  isPublicMarketingPath,
  getApexAliasRedirect,
} from "@/lib/public-path";
import { getInviteTicketRedirect } from "@/lib/inviteRedirect";
import { planFromClerkHas, type ClerkHas } from "@/lib/billingAccess";

const isAdminRoute = createRouteMatcher([
  "/",
  "/app",
  "/admin(.*)",
  "/app/admin(.*)",
  "/reps(.*)",
  "/app/reps(.*)",
  "/coach(.*)",
  "/app/coach(.*)",
  "/invite(.*)",
  "/app/invite(.*)",
]);

const isAdminApiRoute = createRouteMatcher([
  "/api/admin(.*)",
  "/api/coach(.*)",
  "/api/reps/(.*)/persona",
  "/api/invites",
  "/api/invites(.*)",
]);

function clerkHandlerImpl() {
  return clerkMiddleware(async (auth, req) => {
      const alias = redirectApexAliases(req);
      if (alias) return alias;
      const ticket = redirectInviteTickets(req);
      if (ticket) return ticket;

      const publicPath = getPublicPath(req);
      if (isPublicApiRoute(publicPath, req.method)) {
        return nextWithPath(req, publicPath);
      }

      // Apex `/` and `/app/marketing` are the public landing. Do not treat
      // middleware `/` (the /app dashboard under basePath) as marketing.
      if (isPublicMarketingPath(publicPath)) {
        return nextWithPath(req, publicPath);
      }

      // One Clerk read per request. A second auth() plus currentUser() in the layout
      // was a full extra round trip on every click.
      const authData = await auth({ treatPendingAsSignedOut: false });
      const pendingTeamPath = pendingTeamSelectionPath({
        sessionStatus: authData.sessionStatus,
        publicPath,
      });
      if (pendingTeamPath && !isApiRoute(publicPath) && !isPublicApiRoute(publicPath, req.method)) {
        return NextResponse.redirect(new URL(pendingTeamPath, req.url));
      }

      // Sign-in/up and a few APIs must not HTML-redirect (fetch() would parse HTML as JSON).
      if (isPublicAuthRoute(publicPath) || isPublicApiRoute(publicPath, req.method)) {
        return nextWithPath(req, publicPath);
      }

      if (pendingTeamPath && isApiRoute(publicPath)) {
        return NextResponse.json({ error: "Choose a team to finish signing in." }, { status: 401 });
      }

      if (!authData.userId) {
        if (isApiRoute(publicPath)) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        return authData.redirectToSignIn();
      }

      if (!authData.orgId) {
        if (isApiRoute(publicPath)) {
          return NextResponse.json({ error: "Choose a team to finish signing in." }, { status: 401 });
        }
        return NextResponse.redirect(new URL(toAppPath("/select-organization"), req.url));
      }

      const metadataRole = (authData.sessionClaims?.metadata as { role?: string } | undefined)?.role;
      const hasOrgAdmin =
        (typeof authData.has === "function" && authData.has({ role: "org:admin" })) ||
        authData.orgRole === "org:admin";
      const role = resolveUserRole({
        orgRole: authData.orgRole,
        hasOrgAdmin,
        metadataRole,
        clerkConfigured: true,
        userId: authData.userId,
      });

      if (role === "member") {
        const denied = enforceMemberBoundaries(req);
        if (denied) return denied;
      }

      return nextWithPath(req, publicPath, authData);
    }, {
      // Do not advertise /__auth (Next's stripped path). Handshake must stay on /app/__auth.
      frontendApiProxy: { enabled: false },
    });
}

let clerkHandler: ReturnType<typeof clerkHandlerImpl> | null = null;

function getClerkHandler() {
  if (!hasClerkServerAuth()) return null;
  if (!clerkHandler) clerkHandler = clerkHandlerImpl();
  return clerkHandler;
}

function redirectApexAliases(req: NextRequest): NextResponse | null {
  const alias = getApexAliasRedirect(req.url);
  if (!alias) return null;
  return NextResponse.redirect(alias.location, alias.status);
}

function redirectInviteTickets(req: NextRequest): NextResponse | null {
  const ticket = getInviteTicketRedirect(req.url);
  if (!ticket) return null;
  return NextResponse.redirect(ticket.location, ticket.status);
}

const AUTH_HEADERS = [
  "x-sc-auth",
  "x-sc-user-id",
  "x-sc-org-id",
  "x-sc-org-role",
  "x-sc-org-admin",
  "x-sc-email",
  "x-sc-name",
  "x-sc-metadata-role",
  "x-sc-plan",
] as const;

function claimString(claims: Record<string, unknown> | null | undefined, key: string): string {
  const value = claims?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function nextWithPath(
  req: NextRequest,
  publicPath: string,
  authData?: {
    userId: string | null;
    orgId?: string | null;
    orgRole?: string | null;
    sessionStatus?: string | null;
    sessionClaims?: unknown;
    has?: (params: { role: string } | { plan: string } | { feature: string }) => boolean;
  }
): NextResponse {
  const requestHeaders = new Headers(req.headers);
  for (const key of AUTH_HEADERS) requestHeaders.delete(key);
  requestHeaders.set("x-salescoach-path", publicPath);

  const claims = (authData?.sessionClaims || null) as Record<string, unknown> | null;
  const active = Boolean(authData?.userId) && authData?.sessionStatus !== "pending";
  if (active && authData) {
    const hasOrgAdmin =
      (typeof authData.has === "function" && authData.has({ role: "org:admin" })) ||
      authData.orgRole === "org:admin";
    const metadata = claims?.metadata as { role?: string } | undefined;
    const first = claimString(claims, "first_name") || claimString(claims, "firstName");
    const last = claimString(claims, "last_name") || claimString(claims, "lastName");
    const name =
      claimString(claims, "name") ||
      claimString(claims, "full_name") ||
      claimString(claims, "fullName") ||
      [first, last].filter(Boolean).join(" ");
    requestHeaders.set("x-sc-auth", "1");
    requestHeaders.set("x-sc-user-id", authData.userId || "");
    if (authData.orgId) requestHeaders.set("x-sc-org-id", authData.orgId);
    if (authData.orgRole) requestHeaders.set("x-sc-org-role", authData.orgRole);
    if (hasOrgAdmin) requestHeaders.set("x-sc-org-admin", "1");
    const email =
      claimString(claims, "email") ||
      claimString(claims, "email_address") ||
      claimString(claims, "primary_email_address");
    if (email) requestHeaders.set("x-sc-email", email);
    if (name) requestHeaders.set("x-sc-name", name);
    if (metadata?.role) requestHeaders.set("x-sc-metadata-role", metadata.role);
    const planId = planFromClerkHas(typeof authData.has === "function" ? (authData.has as ClerkHas) : undefined);
    if (planId) requestHeaders.set("x-sc-plan", planId);
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

function memberCallsRedirect(req: NextRequest): NextResponse {
  return NextResponse.redirect(new URL(toAppPath("/calls"), req.url));
}

function enforceMemberBoundaries(req: NextRequest): NextResponse | null {
  if (isAdminRoute(req)) {
    return memberCallsRedirect(req);
  }
  if (isAdminApiRoute(req)) {
    return NextResponse.json({ error: "Forbidden: Admin permissions required" }, { status: 403 });
  }
  return null;
}

export default function middleware(request: NextRequest, event: NextFetchEvent) {
  const alias = redirectApexAliases(request);
  if (alias) return alias;
  const ticket = redirectInviteTickets(request);
  if (ticket) return ticket;

  const handler = getClerkHandler();
  if (handler) {
    return handler(request, event);
  }

  const role = resolveUserRole({
    clerkConfigured: false,
    userId: null,
  });
  if (role === "member") {
    const denied = enforceMemberBoundaries(request);
    if (denied) return denied;
  }

  return nextWithPath(request, getPublicPath(request));
}

export const config = {
  matcher: [
    // Base-path root ("/" → "/app"): without this, the exact root bypasses the matcher under basePath
    "/",
    "/calls",
    "/calls/:path*",
    "/favicon.ico",
    "/icon.svg",
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|mp3|wav|m4a|aac|ogg|webm|flac)).*)",
    "/(api|trpc)(.*)",
  ],
};

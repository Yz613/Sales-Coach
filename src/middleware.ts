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
import { analyticsConnectHosts, analyticsScriptHosts } from "@/lib/analytics-policy";
import { fallbackContentSecurityPolicy, tagConnectHosts, tagImgHosts, tagScriptHosts } from "@/lib/page-views";
import { visitorFollowUpConnectHosts, visitorFollowUpScriptHosts } from "@/lib/visitorFollowUpPublic";
import { assertSecureDeployment, assertMutationOrigin, privateResponse } from "@/lib/security-policy";

const isAdminRoute = createRouteMatcher([
  "/",
  "/app",
  "/admin(.*)",
  "/app/admin(.*)",
  "/reps(.*)",
  "/app/reps(.*)",
  "/coach(.*)",
  "/app/coach(.*)",
  "/deals(.*)",
  "/app/deals(.*)",
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

      return nextWithPath(req, publicPath);
    }, {
      // Do not advertise /__auth (Next's stripped path). Handshake must stay on /app/__auth.
      frontendApiProxy: { enabled: false },
      contentSecurityPolicy: {
        strict: true,
        directives: {
          "object-src": ["'none'"], "base-uri": ["'self'"], "frame-ancestors": ["'none'"],
          "media-src": ["'self'", "https:", "blob:"],
          "script-src": [...tagScriptHosts, ...analyticsScriptHosts, ...visitorFollowUpScriptHosts()],
          "connect-src": [...tagConnectHosts, ...analyticsConnectHosts, ...visitorFollowUpConnectHosts()],
          "img-src": ["'self'", "https://img.clerk.com", "data:", ...tagImgHosts],
        },
      },
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

function nextWithPath(req: NextRequest, publicPath: string): NextResponse {
  const requestHeaders = new Headers(req.headers);
  for (const key of AUTH_HEADERS) requestHeaders.delete(key);
  requestHeaders.set("x-salescoach-path", publicPath);
  let policy: string | undefined;
  if (!hasClerkServerAuth()) {
    const nonce = btoa(crypto.randomUUID());
    policy = fallbackContentSecurityPolicy(nonce, process.env.NODE_ENV !== "production");
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("content-security-policy", policy);
  }
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (policy) response.headers.set("content-security-policy", policy);
  if (isApiRoute(publicPath)) response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
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

export default async function middleware(request: NextRequest, event: NextFetchEvent) {
  const alias = redirectApexAliases(request);
  if (alias) return alias;
  const ticket = redirectInviteTickets(request);
  if (ticket) return ticket;

  const handler = getClerkHandler();
  if (handler) {
    const response = await handler(request, event);
    // Clerk can reject before Next's route/header pipeline runs.
    return response && isApiRoute(getPublicPath(request)) ? privateResponse(response) : response;
  }

  if (!isPublicMarketingPath(getPublicPath(request)) && !isPublicAuthRoute(getPublicPath(request)) && !isPublicApiRoute(getPublicPath(request), request.method)) {
    try { assertSecureDeployment(); assertMutationOrigin(request); }
    catch { return privateResponse(NextResponse.json({ error: "Service security configuration is incomplete." }, { status: 503 })); }
  }

  return nextWithPath(request, getPublicPath(request));
}

export const config = {
  matcher: [
    // Base-path root ("/" → "/app"): without this, the exact root bypasses the matcher under basePath.
    // Do not match /icon.svg or /favicon.ico. Those are static files. An explicit
    // matcher sends signed-out visitors to sign-in instead of the icon.
    "/",
    "/calls",
    "/calls/:path*",
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|mp3|wav|m4a|aac|ogg|webm|flac)).*)",
    "/(api|trpc)(.*)",
  ],
};

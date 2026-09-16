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

      // Apex `/` and `/app/marketing` are the public landing. Do not treat
      // middleware `/` (the /app dashboard under basePath) as marketing.
      if (isPublicMarketingPath(publicPath)) {
        return nextWithPath(req, publicPath);
      }

      const pendingAuth = await auth({ treatPendingAsSignedOut: false });
      const pendingTeamPath = pendingTeamSelectionPath({
        sessionStatus: pendingAuth.sessionStatus,
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

      const authData = await auth();

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

function nextWithPath(req: NextRequest, publicPath: string): NextResponse {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-salescoach-path", publicPath);
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

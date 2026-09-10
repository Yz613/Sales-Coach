import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { hasClerkServerAuth } from "@/lib/clerk-env";
import { resolveUserRole } from "@/lib/roles";
import {
  getPublicPath,
  toAppPath,
  isPublicAuthRoute,
  isPublicApiRoute,
  isApiRoute,
  getApexAliasRedirect,
} from "@/lib/public-path";

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
]);

const hasClerkKey = hasClerkServerAuth();

function redirectApexAliases(req: NextRequest): NextResponse | null {
  const alias = getApexAliasRedirect(req.url);
  if (!alias) return null;
  return NextResponse.redirect(alias.location, alias.status);
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

const clerkHandler = hasClerkKey
  ? clerkMiddleware(async (auth, req) => {
      const alias = redirectApexAliases(req);
      if (alias) return alias;

      const publicPath = getPublicPath(req);

      // Sign-in/up and a few APIs must not HTML-redirect (fetch() would parse HTML as JSON).
      if (isPublicAuthRoute(publicPath) || isPublicApiRoute(publicPath, req.method)) {
        return;
      }

      const authData = await auth();

      if (!authData.userId) {
        if (isApiRoute(publicPath)) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        return authData.redirectToSignIn();
      }

      const cookieRole = req.cookies.get("sc_role")?.value;
      const metadataRole = (authData.sessionClaims?.metadata as { role?: string } | undefined)?.role;
      const hasOrgAdmin =
        (typeof authData.has === "function" && authData.has({ role: "org:admin" })) ||
        authData.orgRole === "org:admin";
      const role = resolveUserRole({
        cookieRole,
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

      return NextResponse.next();
    })
  : null;

export default function middleware(request: NextRequest, event: NextFetchEvent) {
  const alias = redirectApexAliases(request);
  if (alias) return alias;

  if (clerkHandler) {
    return clerkHandler(request, event);
  }

  const role = resolveUserRole({
    cookieRole: request.cookies.get("sc_role")?.value || "admin",
    clerkConfigured: false,
    userId: null,
  });
  if (role === "member") {
    const denied = enforceMemberBoundaries(request);
    if (denied) return denied;
  }

  return NextResponse.next();
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

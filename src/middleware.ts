import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { resolveUserRole } from "@/lib/roles";

// Public authentication + organization onboarding paths (tolerates optional /app basePath)
const PUBLIC_PATH = /^(?:\/app)?\/(?:sign-in|sign-up|select-organization|create-organization|user|organization)(?:\/|$)/;

const isAdminRoute = createRouteMatcher([
  "/",
  "/app",
  "/admin(.*)",
  "/app/admin(.*)",
  "/reps(.*)",
  "/app/reps(.*)",
  "/coach(.*)",
  "/app/coach(.*)",
]);

const isAdminApiRoute = createRouteMatcher([
  "/api/admin(.*)",
  "/api/coach(.*)",
  "/api/reps/(.*)/persona",
]);

const hasClerkKey = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.trim() !== ""
);

function memberRedirect(req: NextRequest) {
  const redirectUrl = req.nextUrl.pathname.startsWith("/app") ? "/app/calls" : "/calls";
  return NextResponse.redirect(new URL(redirectUrl, req.url));
}

function enforceMemberBoundaries(req: NextRequest, role: string) {
  if (role !== "member") return null;
  if (isAdminRoute(req)) return memberRedirect(req);
  if (isAdminApiRoute(req)) {
    return NextResponse.json({ error: "Forbidden: Admin permissions required" }, { status: 403 });
  }
  return null;
}

const clerkHandler = hasClerkKey
  ? clerkMiddleware(async (auth, req) => {
      if (PUBLIC_PATH.test(req.nextUrl.pathname)) return;

      const authData = await auth();

      if (!authData.userId) {
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

      return enforceMemberBoundaries(req, role) ?? NextResponse.next();
    })
  : null;

export default function middleware(request: NextRequest, event: NextFetchEvent) {
  if (clerkHandler) {
    return clerkHandler(request, event);
  }

  const role = resolveUserRole({
    cookieRole: request.cookies.get("sc_role")?.value || "admin",
    clerkConfigured: false,
    userId: null,
  });
  return enforceMemberBoundaries(request, role) ?? NextResponse.next();
}

export const config = {
  matcher: [
    // Base-path root ("/" → "/app"): without this, the exact root bypasses the matcher under basePath
    "/",
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};

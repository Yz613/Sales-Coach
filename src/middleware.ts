import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Public authentication paths (tolerates optional /app basePath)
const PUBLIC_PATH = /^(?:\/app)?\/(?:sign-in|sign-up)(?:\/|$)/;

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

const clerkHandler = hasClerkKey
  ? clerkMiddleware(async (auth, req) => {
      // Allow sign-in and sign-up freely
      if (PUBLIC_PATH.test(req.nextUrl.pathname)) return;

      const authData = await auth();

      // Enforce authentication on all protected routes
      if (!authData.userId) {
        return authData.redirectToSignIn();
      }

      // Determine active role
      const cookieRole = req.cookies.get("sc_role")?.value;
      let role = cookieRole;

      if (!role) {
        const metadataRole = (authData.sessionClaims?.metadata as any)?.role;
        if (metadataRole === "admin" || metadataRole === "member") {
          role = metadataRole;
        } else if (authData.orgRole === "org:admin") {
          role = "admin";
        } else {
          role = "member";
        }
      }

      // Enforce Member role boundaries (Members can only upload & view calls/scoring)
      if (role === "member") {
        if (isAdminRoute(req)) {
          const redirectUrl = req.nextUrl.pathname.startsWith("/app") ? "/app/calls" : "/calls";
          return NextResponse.redirect(new URL(redirectUrl, req.url));
        }
        if (isAdminApiRoute(req)) {
          return NextResponse.json({ error: "Forbidden: Admin permissions required" }, { status: 403 });
        }
      }

      return NextResponse.next();
    })
  : null;

export default function middleware(request: NextRequest, event: NextFetchEvent) {
  if (clerkHandler) {
    return clerkHandler(request, event);
  }

  // Fallback when Clerk keys are not yet configured in .env:
  const role = request.cookies.get("sc_role")?.value || "admin";
  if (role === "member") {
    if (isAdminRoute(request)) {
      const redirectUrl = request.nextUrl.pathname.startsWith("/app") ? "/app/calls" : "/calls";
      return NextResponse.redirect(new URL(redirectUrl, request.url));
    }
    if (isAdminApiRoute(request)) {
      return NextResponse.json({ error: "Forbidden: Admin permissions required" }, { status: 403 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Base-path root ("/" → "/app"): without this, the exact root bypasses the matcher under basePath
    "/",
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};

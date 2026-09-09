import { clerkMiddleware } from "@clerk/nextjs/server";

// The app is served under the `/app` base path. Depending on how Next exposes
// the path to middleware, `pathname` may or may not include that prefix, so the
// public-route check tolerates both forms.
const PUBLIC_PATH = /^(?:\/app)?\/(?:sign-in|sign-up)(?:\/|$)/;

export default clerkMiddleware(async (auth, req) => {
  if (PUBLIC_PATH.test(req.nextUrl.pathname)) return;

  const { isAuthenticated, redirectToSignIn } = await auth();
  if (!isAuthenticated) {
    return redirectToSignIn();
  }
});

export const config = {
  matcher: [
    // Base-path root ("/" → "/app"): without this, the exact root bypasses the
    // matcher under basePath and would not be gated.
    "/",
    // Run on everything except Next internals and static asset file types.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};

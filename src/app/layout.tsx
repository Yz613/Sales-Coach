import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import "./globals.css";
import AppChrome from "@/components/AppChrome";
import AuthProvider from "@/components/AuthProvider";
import PageViewTracker from "@/components/PageViewTracker";
import ProductAnalytics from "@/components/ProductAnalytics";
import { TAG_SCRIPT_SRC, pageViewBootstrap } from "@/lib/page-views";
import { VISITOR_FOLLOW_UP_SITE_ID, visitorFollowUpBrowserScriptSrc } from "@/lib/visitorFollowUpPublic";
import { authRedirectPath, getServerAuth, publicGuestAuth } from "@/lib/auth";
import {
  isApiRoute,
  isPublicAuthRoute,
  isPublicMarketingPath,
  toAppPath,
  stripAppBasePath,
} from "@/lib/public-path";

export const metadata: Metadata = {
  title: "Sales Coach AI — B2B Sales Management & Progression",
  description: "Executive AI Sales Manager for evaluating call blocking & tackling, Sandler qualification, and rep pipeline progression.",
  icons: {
    icon: [{ url: toAppPath("/icon.svg"), type: "image/svg+xml" }],
    apple: [{ url: toAppPath("/apple-touch-icon.png"), sizes: "180x180", type: "image/png" }],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
  const followUpScriptSrc = visitorFollowUpBrowserScriptSrc();
  const requestHeaders = await headers();
  const nonce = requestHeaders.get("x-nonce") || undefined;
  const path = requestHeaders.get("x-salescoach-path") || "";
  const publicAuth = isPublicAuthRoute(path);
  const marketing = isPublicMarketingPath(path);
  const gatedPage =
    path &&
    !marketing &&
    !publicAuth &&
    !isApiRoute(path);

  // Marketing and sign-in must not wait on Clerk, D1, or billing.
  const auth = publicAuth || marketing ? publicGuestAuth() : await getServerAuth();
  const dest = gatedPage ? authRedirectPath(auth) : null;
  if (dest) {
    // Next server redirects add basePath themselves; middleware/Clerk URLs do not.
    redirect(stripAppBasePath(dest));
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="ambient-field min-h-screen text-[#1d1d1f] antialiased relative overflow-x-hidden" suppressHydrationWarning>
        <script async nonce={nonce} src={TAG_SCRIPT_SRC} />
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: pageViewBootstrap() }} />
        {followUpScriptSrc ? (
          <script async nonce={nonce} src={followUpScriptSrc} data-site={VISITOR_FOLLOW_UP_SITE_ID} />
        ) : null}
        <Suspense fallback={null}>
          <PageViewTracker />
        </Suspense>
        <AuthProvider
          nonce={nonce}
          initialRole={auth.role}
          publishableKey={publishableKey}
          skipRoleFetch={publicAuth || marketing}
          initialUser={
            auth.userId ? { id: auth.userId, email: auth.email, name: auth.name } : null
          }
        >
          <ProductAnalytics />
          <AppChrome>{children}</AppChrome>
        </AuthProvider>
      </body>
    </html>
  );
}

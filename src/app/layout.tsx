import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import "./globals.css";
import AppChrome from "@/components/AppChrome";
import AuthProvider from "@/components/AuthProvider";
import { authRedirectPath, getServerAuth, publicGuestAuth } from "@/lib/auth";
import {
  isApiRoute,
  isPublicAuthRoute,
  isPublicMarketingPath,
  toAppPath,
} from "@/lib/public-path";

export const metadata: Metadata = {
  title: "Sales Coach AI — B2B Sales Management & Progression",
  description: "Executive AI Sales Manager for evaluating call blocking & tackling, Sandler qualification, and rep pipeline progression.",
  icons: {
    icon: [{ url: toAppPath("/icon.svg"), type: "image/svg+xml" }],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
  const path = (await headers()).get("x-salescoach-path") || "";
  const publicAuth = isPublicAuthRoute(path);
  const gatedPage =
    path &&
    !isPublicMarketingPath(path) &&
    !publicAuth &&
    !isApiRoute(path);

  // Sign-in/up must not wait on D1 or billing. A hung getServerAuth() renders a blank page.
  const auth = publicAuth ? publicGuestAuth() : await getServerAuth();
  const dest = gatedPage ? authRedirectPath(auth) : null;
  if (dest) {
    redirect(dest);
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="ambient-field min-h-screen text-[#1d1d1f] antialiased relative overflow-x-hidden" suppressHydrationWarning>
        <AuthProvider
          initialRole={auth.role}
          publishableKey={publishableKey}
          skipRoleFetch={publicAuth}
          initialUser={
            auth.userId ? { id: auth.userId, email: auth.email, name: auth.name } : null
          }
        >
          <AppChrome>{children}</AppChrome>
        </AuthProvider>
      </body>
    </html>
  );
}

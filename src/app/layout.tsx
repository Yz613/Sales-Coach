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
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-[#070a12] text-slate-100 antialiased selection:bg-blue-600 selection:text-white relative overflow-x-hidden" suppressHydrationWarning>
        {/* Soft light only. CSS blur filters make Chrome paint a blank frame after a tab switch. */}
        <div className="ambient-field pointer-events-none fixed inset-0 -z-10" aria-hidden="true" />
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

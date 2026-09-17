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
        {/* Atmospheric ambient lighting for glass refraction */}
        <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden" aria-hidden="true">
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[400px] bg-gradient-to-b from-blue-600/15 via-indigo-600/10 to-transparent blur-[120px] rounded-full" />
          <div className="absolute top-1/3 -right-40 w-[600px] h-[500px] bg-indigo-900/10 blur-[140px] rounded-full" />
          <div className="absolute top-2/3 -left-40 w-[600px] h-[500px] bg-blue-900/10 blur-[140px] rounded-full" />
        </div>
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

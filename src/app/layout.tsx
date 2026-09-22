import type { Metadata } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
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

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-sans",
  adjustFontFallback: true,
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-mono",
  adjustFontFallback: true,
});

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
    <html lang="en" className={`${sans.variable} ${mono.variable} dark`} suppressHydrationWarning>
      <body className="min-h-screen bg-[#070a12] text-slate-100 antialiased selection:bg-blue-600 selection:text-white relative overflow-x-hidden" suppressHydrationWarning>
        {/* Atmospheric ambient lighting for glass refraction */}
        <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden" aria-hidden="true">
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[400px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(37,99,235,0.16),transparent_68%)]" />
          <div className="absolute top-1/3 -right-40 w-[600px] h-[500px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(49,46,129,0.16),transparent_70%)]" />
          <div className="absolute top-2/3 -left-40 w-[600px] h-[500px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(30,58,138,0.14),transparent_70%)]" />
        </div>
        <AuthProvider
          initialRole={auth.role}
          publishableKey={publishableKey}
          skipRoleFetch
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
